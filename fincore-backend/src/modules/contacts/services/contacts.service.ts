// src/modules/contacts/services/contacts.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ContactType, Prisma, NotificationType } from '@prisma/client';
import { CreateContactDto, UpdateContactDto, QueryContactDto, SetCustomFieldDto } from '../dto/contact.dto';
// FIX: `@prisma/client/runtime/library` is an internal Prisma path removed in Prisma 5.
// Import Decimal from the standalone decimal.js package instead — it is the same
// class that Prisma uses internally and is already a transitive dependency.
import Decimal from 'decimal.js';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  async create(organizationId: string, userId: string, dto: CreateContactDto) {
    // Enforce free-plan contact limit
    await this.subscriptions.assertUsageAllowed(organizationId, 'contactCount');

    // Auto-generate code if not provided
    const code = dto.code ?? (await this.generateCode(organizationId, dto.contactType));

    // Ensure code is unique per org
    const existing = await this.prisma.contact.findUnique({
      where: { organizationId_code: { organizationId, code } },
    });
    if (existing) throw new ConflictException(`Contact code '${code}' already exists`);

    const contact = await this.prisma.contact.create({
      data: {
        organizationId,
        createdById: userId,
        contactType: dto.contactType,
        code,
        displayName: dto.displayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyName: dto.companyName,
        jobTitle: dto.jobTitle,
        email: dto.email?.toLowerCase(),
        email2: dto.email2?.toLowerCase(),
        phone: dto.phone,
        phone2: dto.phone2,
        whatsapp: dto.whatsapp,
        website: dto.website,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country ?? 'PK',
        taxId: dto.taxId,
        currency: dto.currency ?? 'PKR',
        creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : null,
        paymentTerms: dto.paymentTerms,
        openingBalance: dto.openingBalance ? new Decimal(dto.openingBalance) : null,
        bankName: dto.bankName,
        bankIban: dto.bankIban,
        bankAccount: dto.bankAccount,
        tags: dto.tags ?? [],
        notes: dto.notes,
        portalEnabled: dto.portalEnabled ?? false,
      },
    });

    // Track usage for plan limits
    await this.subscriptions.incrementUsage(organizationId, 'contactCount');

    // Add extra fields as a note on the contact record (CNIC, S/O Name, DOB, DOE)
    const extraInfo = this.buildExtraInfoNote(dto);
    if (extraInfo) {
      await this.addNote(contact.id, userId, `${dto.displayName}`, extraInfo);
    }

    this.logger.log(`Contact created: ${contact.id} (${contact.code}) in org ${organizationId}`);
    return contact;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async findAll(organizationId: string, query: QueryContactDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.contactType && { contactType: query.contactType }),
      ...(query.tag && { tags: { has: query.tag } }),
      ...(query.search && {
        OR: [
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
          { companyName: { contains: query.search, mode: 'insensitive' } },
          { taxId: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          code: true,
          contactType: true,
          displayName: true,
          companyName: true,
          email: true,
          phone: true,
          city: true,
          country: true,
          tags: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async picker(
    organizationId: string,
    search?: string,
    contactType?: ContactType,
    limit: number = 20,
  ) {
    return this.prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        ...(contactType ? { contactType: { in: [contactType, ContactType.BOTH] } } : {}),
        ...(search
          ? {
              OR: [
                { displayName: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { taxId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        contactType: true,
        displayName: true,
        companyName: true,
        email: true,
        phone: true,
      },
      orderBy: { displayName: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async findOne(organizationId: string, id: string) {
    // FIX: `notes` is not a relation in ContactInclude — it is a scalar text
    // field on the Contact model itself. The `include` block only accepts
    // relation names. Fetching notes as a separate ContactNote relation must
    // be done via a dedicated query (see getNotes()). Remove the erroneous
    // include here; the scalar `notes` field is returned automatically in
    // the base contact object.
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!contact) throw new NotFoundException(`Contact ${id} not found`);

    // Attach custom field values
    const customValues = await this.prisma.customFieldValue.findMany({
      where: { resourceId: id },
      include: { fieldDef: true },
    });

    // Fetch chatter notes via the ContactNote relation (separate query)
    const contactNotes = await this.prisma.contactNote.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const attachments = await this.prisma.contactAttachment.findMany({
      where: { organizationId, contactId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Attach smart button counts (Odoo-style)
    const summary = await this.getSmartButtonCounts(organizationId, id);

    return { ...contact, contactNotes, attachments, customFields: customValues, summary };
  }

  /** Smart button counts — mirrors the Odoo header badges */
  async getSmartButtonCounts(organizationId: string, contactId: string) {
    const [
      invoiceCount,
      invoicedAmountRaw,
      saleOrderCount,
      purchaseOrderCount,
      appointmentCount,
      documentCount,
    ] = await Promise.all([
      this.prisma.invoice.count({ where: { organizationId, customerId: contactId } }),
      this.prisma.invoice.aggregate({
        where: { organizationId, customerId: contactId },
        _sum: { totalAmount: true },
      }),
      this.prisma.saleOrder.count({ where: { organizationId, customerId: contactId } }),
      this.prisma.purchaseOrder.count({ where: { organizationId, vendorId: contactId } }),
      this.prisma.appointment.count({ where: { organizationId, contactId } }),
      this.prisma.document.count({
        where: { organizationId, recipientId: contactId, deletedAt: null },
      }),
    ]);

    return {
      invoiceCount,
      invoicedAmount: invoicedAmountRaw._sum.totalAmount?.toString() ?? '0.00',
      saleOrderCount,
      purchaseOrderCount,
      appointmentCount,
      documentCount,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  async update(organizationId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(organizationId, id);

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
        email2: dto.email2?.toLowerCase(),
        creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : undefined,
        openingBalance: dto.openingBalance ? new Decimal(dto.openingBalance) : undefined,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE  (soft-delete)
  // ══════════════════════════════════════════════════════════════════════════

  async remove(organizationId: string, id: string): Promise<{ deleted: boolean }> {
    await this.findOne(organizationId, id);
    await this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { deleted: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTES  (chatter — "Send message / Log note")
  // ══════════════════════════════════════════════════════════════════════════

  async addNote(contactId: string, userId: string, authorName: string, body: string) {
    return this.prisma.contactNote.create({
      data: { contactId, authorId: userId, authorName, body },
    });
  }

  async getNotes(organizationId: string, contactId: string) {
    // Verify contact belongs to org first
    await this.findOne(organizationId, contactId);
    return this.prisma.contactNote.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CUSTOM FIELDS  (Owner-defined extra fields)
  // ══════════════════════════════════════════════════════════════════════════

  /** Get all custom field definitions for the Contact model */
  async getCustomFieldDefs(organizationId: string) {
    return this.prisma.customFieldDef.findMany({
      where: { organizationId, targetModel: 'Contact', isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Create a new custom field definition */
  async createCustomFieldDef(
    organizationId: string,
    dto: {
      label: string;
      fieldKey: string;
      fieldType: string;
      isRequired?: boolean;
      defaultValue?: string;
      options?: string[];
      sortOrder?: number;
    },
  ) {
    if (
      (dto.fieldType === 'SELECT' || dto.fieldType === 'MULTI_SELECT') &&
      (!dto.options || dto.options.length === 0)
    ) {
      throw new BadRequestException('SELECT and MULTI_SELECT custom fields require options');
    }

    const existing = await this.prisma.customFieldDef.findUnique({
      where: {
        organizationId_targetModel_fieldKey: {
          organizationId,
          targetModel: 'Contact',
          fieldKey: dto.fieldKey,
        },
      },
    });
    if (existing) throw new ConflictException(`Field key '${dto.fieldKey}' already exists`);

    return this.prisma.customFieldDef.create({
      data: {
        organizationId,
        targetModel: 'Contact',
        fieldKey: dto.fieldKey,
        label: dto.label,
        fieldType: dto.fieldType as any,
        isRequired: dto.isRequired ?? false,
        defaultValue: dto.defaultValue,
        options: dto.options,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /** Set a custom field value for a contact */
  async setCustomFieldValue(organizationId: string, contactId: string, dto: SetCustomFieldDto) {
    await this.findOne(organizationId, contactId);

    const fieldDef = await this.prisma.customFieldDef.findUnique({
      where: { id: dto.fieldDefId },
    });
    if (!fieldDef || fieldDef.organizationId !== organizationId) {
      throw new NotFoundException('Custom field definition not found');
    }
    if (fieldDef.isRequired && (dto.value === undefined || dto.value === '')) {
      throw new BadRequestException(`Field '${fieldDef.label}' is required`);
    }

    return this.prisma.customFieldValue.upsert({
      where: { fieldDefId_resourceId: { fieldDefId: dto.fieldDefId, resourceId: contactId } },
      create: { fieldDefId: dto.fieldDefId, resourceId: contactId, value: dto.value },
      update: { value: dto.value },
    });
  }

  /** Bulk set custom field values for a contact */
  async setCustomFieldValues(
    organizationId: string,
    contactId: string,
    fields: SetCustomFieldDto[],
  ) {
    return Promise.all(fields.map((f) => this.setCustomFieldValue(organizationId, contactId, f)));
  }

  async addAttachment(
    organizationId: string,
    contactId: string,
    uploadedById: string,
    input: { fileName: string; mimeType: string; sizeBytes: number; s3Key: string },
  ) {
    await this.findOne(organizationId, contactId);
    return this.prisma.contactAttachment.create({
      data: { organizationId, contactId, uploadedById, ...input },
    });
  }

  async listAttachments(organizationId: string, contactId: string) {
    await this.findOne(organizationId, contactId);
    return this.prisma.contactAttachment.findMany({
      where: { organizationId, contactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeAttachment(organizationId: string, contactId: string, attachmentId: string) {
    await this.findOne(organizationId, contactId);
    await this.prisma.contactAttachment.deleteMany({
      where: { id: attachmentId, organizationId, contactId },
    });
    return { deleted: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PORTAL ACCESS
  // ══════════════════════════════════════════════════════════════════════════

  async enablePortal(organizationId: string, contactId: string, portalUserId: string) {
    await this.findOne(organizationId, contactId);
    return this.prisma.contact.update({
      where: { id: contactId },
      data: { portalEnabled: true, portalUserId },
    });
  }

  async disablePortal(organizationId: string, contactId: string) {
    await this.findOne(organizationId, contactId);
    return this.prisma.contact.update({
      where: { id: contactId },
      data: { portalEnabled: false, portalUserId: null },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private async generateCode(organizationId: string, contactType: ContactType): Promise<string> {
    const prefix: Record<ContactType, string> = {
      CUSTOMER: 'CUST',
      VENDOR: 'VEND',
      BOTH: 'CONT',
      BANK: 'BANK',
      LEAD: 'LEAD',
      PARTNER: 'PRTN',
      INTERNAL: 'INT',
    };

    const pfx = prefix[contactType] ?? 'CONT';

    // Find the highest existing code number for this prefix in this org
    const last = await this.prisma.contact.findFirst({
      where: { organizationId, code: { startsWith: pfx } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const lastNum = last ? parseInt(last.code.replace(pfx + '-', ''), 10) : 0;

    return `${pfx}-${String(lastNum + 1).padStart(4, '0')}`;
  }

  /** Build a log note from the extra Pakistani compliance fields */
  private buildExtraInfoNote(dto: CreateContactDto): string | null {
    const lines: string[] = [];
    if ((dto as any).soName) lines.push(`S/O Name: ${(dto as any).soName}`);
    if (dto.taxId) lines.push(`NTN: ${dto.taxId}`);
    if ((dto as any).cnic) lines.push(`CNIC: ${(dto as any).cnic}`);
    if ((dto as any).dateOfBirth) lines.push(`DOB: ${(dto as any).dateOfBirth}`);
    if ((dto as any).dateOfExpire) lines.push(`Expiry: ${(dto as any).dateOfExpire}`);
    return lines.length ? `Additional Info:\n${lines.join('\n')}` : null;
  }
}
