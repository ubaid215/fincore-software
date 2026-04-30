/**
 * src/modules/invoicing/services/invoices.service.ts
 *
 * FIXES:
 *  1.  create() — customerId FK + auto-populate snapshot from Contact
 *  2.  create() — assertUsageAllowed('invoiceCount') enforces free plan limit
 *  3.  create() — incrementUsage('invoiceCount') after successful create
 *  4.  send()   — sentAt timestamp stored
 *  5.  findAll() — deletedAt:null filter + soft-delete support
 *  6.  findAll() — customerId filter
 *  7.  recordPayment() — VIEWED added to payableStatuses
 *  8.  recordPayment() — paidAt set on invoice when status → PAID
 *  9.  recordPayment() — exchangeRate stored on InvoicePayment
 *  10. defaultInclude() — customer Contact included
 *  11. NotificationsService injected — real-time broadcasts on send/payment
 *  12. AuditLog written on create/send/payment
 *  13. @Cron overdue marker — daily cron marks SENT/VIEWED/PARTIALLY_PAID → OVERDUE
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { InvoiceStatus, RecurringPeriod } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FxRateService } from './fx-rate.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '@prisma/client';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  RecordPaymentDto,
  QueryInvoicesDto,
} from '../dto/create-invoice.dto';
import {
  INVOICE_TRANSITIONS,
  type ComputedLineItem,
  type InvoiceTotals,
  type PdfJobPayload,
  type PaymentStatusResult,
} from '../types/invoice.types';
import Decimal from 'decimal.js';
import { toDecimal, roundMoney, calculateLineTotal } from '../../../common/utils/decimal.util';
import {
  parsePagination,
  buildPaginatedResult,
  type PaginatedResult,
} from '../../../common/utils/pagination.util';

export const PDF_QUEUE = 'invoice-pdf';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fxService: FxRateService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(PDF_QUEUE) private readonly pdfQueue: Queue,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  async create(organizationId: string, userId: string, dto: CreateInvoiceDto) {
    // FIX 2: Enforce free plan limit before DB write
    await this.subscriptions.assertUsageAllowed(organizationId, 'invoiceCount');

    const currency = (dto.currency ?? 'PKR').toUpperCase();

    // FIX 1: Auto-populate snapshot from Contact if customerId provided
    let clientName = dto.clientName;
    let clientEmail = dto.clientEmail ?? null;
    let clientAddress = dto.clientAddress ?? null;
    let clientTaxId = dto.clientTaxId ?? null;

    if (dto.customerId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
        select: {
          displayName: true,
          email: true,
          addressLine1: true,
          city: true,
          country: true,
          taxId: true,
        },
      });
      if (contact) {
        // Snapshot: use DTO override if provided, else pull from Contact
        clientName = dto.clientName || contact.displayName;
        clientEmail = dto.clientEmail ?? contact.email ?? null;
        clientAddress =
          (dto.clientAddress ??
            [contact.addressLine1, contact.city, contact.country].filter(Boolean).join(', ')) ||
          null;
        clientTaxId = dto.clientTaxId ?? contact.taxId ?? null;
      }
    }

    // FX rate
    const exchangeRate = dto.exchangeRate
      ? new Decimal(dto.exchangeRate)
      : new Decimal(await this.fxService.getRate(currency));

    const computedLines = this.computeLineItems(dto.lineItems);
    const totals = this.aggregateTotals(computedLines);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(organizationId, tx);

      const created = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          customerId: dto.customerId ?? null, // FIX 1
          clientName,
          clientEmail,
          clientAddress,
          clientTaxId,
          purchaseOrder: dto.purchaseOrder ?? null, // FIX 18
          reference: null,
          issueDate: new Date(dto.issueDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          currency,
          exchangeRate: exchangeRate.toString(), // FIX 20
          subtotal: totals.subtotal.toString(),
          taxAmount: totals.taxAmount.toString(),
          discountAmount: totals.discountAmount.toString(),
          totalAmount: totals.totalAmount.toString(),
          amountPaid: '0',
          amountDue: totals.totalAmount.toString(),
          terms: dto.terms ?? null, // FIX 19
          notes: dto.notes ?? null,
          isRecurring: dto.isRecurring ?? false,
          recurringPeriod: dto.recurringPeriod ?? null,
          recurringEndDate: dto.recurringEndDate ? new Date(dto.recurringEndDate) : null,
          status: InvoiceStatus.DRAFT,
          lineItems: { create: computedLines },
        },
        include: this.defaultInclude(),
      });

      // FIX 12: Audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          app: 'INVOICING',
          action: 'invoice.created',
          resourceType: 'Invoice',
          resourceId: created.id,
          metadata: {
            invoiceNumber: created.invoiceNumber,
            total: totals.totalAmount.toString(),
            currency,
          },
        },
      });

      return created;
    });

    // FIX 3: Track usage AFTER successful create
    await this.subscriptions.incrementUsage(organizationId, 'invoiceCount');

    // FIX 11: Real-time dashboard refresh
    this.notifications.broadcastToOrg(organizationId, 'invoices:created', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: totals.totalAmount.toString(),
    });

    this.logger.log(`Invoice ${invoice.invoiceNumber} created (org: ${organizationId})`);
    return invoice;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async findAll(
    organizationId: string,
    query: QueryInvoicesDto,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null, // FIX 5
      ...(query.status && { status: query.status }),
      ...(query.customerId && { customerId: query.customerId }), // FIX 6
      ...(query.currency && { currency: query.currency.toUpperCase() }),
      ...(query.clientName && { clientName: { contains: query.clientName, mode: 'insensitive' } }),
      ...(query.recurringOnly && { isRecurring: true }),
      ...((query.fromDate || query.toDate) && {
        issueDate: {
          ...(query.fromDate && { gte: new Date(query.fromDate) }),
          ...(query.toDate && { lte: new Date(query.toDate) }),
        },
      }),
      ...(query.overdueOnly && {
        dueDate: { lt: new Date() },
        status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: this.defaultInclude(),
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(organizationId: string, invoiceId: string) {
    return this.findOneOrFail(organizationId, invoiceId);
  }

  async getPayments(organizationId: string, invoiceId: string) {
    await this.findOneOrFail(organizationId, invoiceId);
    return this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: 'desc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  async update(organizationId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(
        `Only DRAFT invoices can be edited. '${invoice.invoiceNumber}' is ${invoice.status}.`,
      );
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(dto.clientName && { clientName: dto.clientName }),
        ...(dto.clientEmail && { clientEmail: dto.clientEmail }),
        ...(dto.clientAddress && { clientAddress: dto.clientAddress }),
        ...(dto.clientTaxId && { clientTaxId: dto.clientTaxId }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.terms !== undefined && { terms: dto.terms }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.purchaseOrder && { purchaseOrder: dto.purchaseOrder }),
      },
      include: this.defaultInclude(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATE TRANSITIONS
  // ══════════════════════════════════════════════════════════════════════════

  async send(organizationId: string, invoiceId: string, userId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);
    this.assertTransition(invoice.status, InvoiceStatus.SENT, invoice.invoiceNumber);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.SENT,
        sentAt: new Date(), // FIX 4
      },
      include: this.defaultInclude(),
    });

    // FIX 12: Audit
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        app: 'INVOICING',
        action: 'invoice.sent',
        resourceType: 'Invoice',
        resourceId: invoiceId,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    });

    await this.enqueuePdfJob(invoiceId, organizationId);

    // FIX 11: Notify org members
    this.notifications.broadcastToOrg(organizationId, 'invoices:sent', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
    });

    // Notify contact if they have a portal user
    if (invoice.customerId) {
      const contact = await this.prisma.contact.findUnique({
        where: { id: invoice.customerId },
        select: { portalUserId: true },
      });
      if (contact?.portalUserId) {
        await this.notifications.createNotification({
          organizationId,
          userId: contact.portalUserId,
          type: NotificationType.INVOICE_SENT,
          title: `Invoice ${invoice.invoiceNumber} sent`,
          body: `You have a new invoice for ${invoice.totalAmount.toString()} ${invoice.currency}`,
          app: 'INVOICING' as any,
          resourceType: 'Invoice',
          resourceId: invoiceId,
        });
      }
    }

    this.logger.log(`Invoice ${invoice.invoiceNumber} sent → PDF job enqueued`);
    return updated;
  }

  async markViewed(organizationId: string, invoiceId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);
    if (invoice.status !== InvoiceStatus.SENT) return invoice; // idempotent
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VIEWED },
      include: this.defaultInclude(),
    });
  }

  async void(organizationId: string, invoiceId: string, userId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        `Invoice '${invoice.invoiceNumber}' is PAID and cannot be voided. Issue a credit note instead.`,
      );
    }

    this.assertTransition(invoice.status, InvoiceStatus.VOID, invoice.invoiceNumber);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID, voidedAt: new Date() },
      include: this.defaultInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        app: 'INVOICING',
        action: 'invoice.voided',
        resourceType: 'Invoice',
        resourceId: invoiceId,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    });

    return updated;
  }

  async markDisputed(organizationId: string, invoiceId: string, userId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);
    this.assertTransition(invoice.status, InvoiceStatus.DISPUTED, invoice.invoiceNumber);

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.DISPUTED },
      include: this.defaultInclude(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ══════════════════════════════════════════════════════════════════════════

  async recordPayment(
    organizationId: string,
    invoiceId: string,
    userId: string,
    dto: RecordPaymentDto,
  ) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    // FIX 7: VIEWED added to payable statuses
    const payableStatuses: InvoiceStatus[] = [
      InvoiceStatus.SENT,
      InvoiceStatus.VIEWED, // FIX 7
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.DISPUTED,
    ];

    if (!payableStatuses.includes(invoice.status)) {
      throw new ConflictException(
        `Cannot record payment on '${invoice.invoiceNumber}' — status is ${invoice.status}.`,
      );
    }

    const paymentAmount = toDecimal(dto.amount);
    const totalAmount = toDecimal(invoice.totalAmount.toString());
    const alreadyPaid = toDecimal(invoice.amountPaid.toString());
    const outstanding = totalAmount.minus(alreadyPaid);

    if (paymentAmount.gt(outstanding)) {
      throw new BadRequestException(
        `Payment ${dto.amount} exceeds outstanding balance (${invoice.currency} ${outstanding.toFixed(2)}).`,
      );
    }

    const newAmountPaid = roundMoney(alreadyPaid.plus(paymentAmount));
    const newAmountDue = roundMoney(totalAmount.minus(newAmountPaid));
    const newStatus = this.computePaymentStatus(newAmountPaid, totalAmount);
    const isFullyPaid = newStatus === InvoiceStatus.PAID;

    // FIX 9: store exchangeRate on payment
    const exchangeRate = dto.exchangeRate
      ? new Decimal(dto.exchangeRate)
      : new Decimal(await this.fxService.getRate(dto.currency ?? invoice.currency));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: paymentAmount.toString(),
          currency: (dto.currency ?? invoice.currency).toUpperCase(),
          exchangeRate: exchangeRate.toString(), // FIX 9
          method: dto.method,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          paidAt: new Date(dto.paidAt),
        },
      });

      const result = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid.toString(),
          amountDue: newAmountDue.toString(),
          status: newStatus,
          // FIX 8: set paidAt when fully paid
          ...(isFullyPaid && { paidAt: new Date(dto.paidAt) }),
        },
        include: this.defaultInclude(),
      });

      // FIX 12: Audit
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          app: 'INVOICING',
          action: 'invoice.payment_recorded',
          resourceType: 'Invoice',
          resourceId: invoiceId,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            amount: dto.amount,
            currency: dto.currency ?? invoice.currency,
            method: dto.method,
            newStatus,
          },
        },
      });

      return result;
    });

    // FIX 11: Notifications
    const notifType = isFullyPaid ? NotificationType.INVOICE_PAID : NotificationType.INVOICE_SENT;
    this.notifications.broadcastToOrg(organizationId, 'invoices:payment', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amount: dto.amount,
      newStatus,
    });

    this.logger.log(`Payment ${dto.amount} on ${invoice.invoiceNumber} → status: ${newStatus}`);

    return updated;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIX 13: OVERDUE CRON — runs daily at 06:00 UTC
  // ══════════════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async markOverdueInvoices(): Promise<void> {
    this.logger.log('[Cron] Marking overdue invoices…');
    const now = new Date();

    const overdueStatuses: InvoiceStatus[] = [
      InvoiceStatus.SENT,
      InvoiceStatus.VIEWED,
      InvoiceStatus.PARTIALLY_PAID,
    ];

    const result = await this.prisma.invoice.updateMany({
      where: {
        status: { in: overdueStatuses },
        dueDate: { lt: now },
        deletedAt: null,
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    this.logger.log(`[Cron] ${result.count} invoice(s) marked OVERDUE`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SOFT DELETE
  // ══════════════════════════════════════════════════════════════════════════

  async remove(organizationId: string, invoiceId: string, userId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    if (!([InvoiceStatus.DRAFT, InvoiceStatus.VOID] as InvoiceStatus[]).includes(invoice.status)) {
      throw new ConflictException(
        `Only DRAFT or VOID invoices can be deleted. '${invoice.invoiceNumber}' is ${invoice.status}.`,
      );
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        app: 'INVOICING',
        action: 'invoice.deleted',
        resourceType: 'Invoice',
        resourceId: invoiceId,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      },
    });

    return { deleted: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FX
  // ══════════════════════════════════════════════════════════════════════════

  async convertToOrganizationCurrency(
    amount: number | string,
    fromCurrency: string,
    toCurrency = 'PKR',
  ): Promise<Decimal> {
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return toDecimal(amount);
    const fromRate = await this.fxService.getRate(fromCurrency);
    const toRate = await this.fxService.getRate(toCurrency);
    return roundMoney(toDecimal(amount).mul(fromRate).div(toRate));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PDF
  // ══════════════════════════════════════════════════════════════════════════

  async regeneratePdf(
    organizationId: string,
    invoiceId: string,
  ): Promise<{ jobId: string | number | undefined }> {
    await this.findOneOrFail(organizationId, invoiceId);
    const job = await this.enqueuePdfJob(invoiceId, organizationId);
    return { jobId: job.id };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private computeLineItems(items: CreateInvoiceDto['lineItems']): ComputedLineItem[] {
    return items.map((item, idx) => {
      const qty = toDecimal(item.quantity);
      const price = toDecimal(item.unitPrice);
      const taxRate = toDecimal(item.taxRate ?? 0);
      const discount = toDecimal(item.discount ?? 0);
      const lineTotal = calculateLineTotal(qty, price, taxRate.toNumber(), discount.toNumber());

      return {
        description: item.description,
        quantity: qty.toDecimalPlaces(4).toString(),
        unitPrice: price.toDecimalPlaces(4).toString(),
        taxCode: item.taxCode ?? null,
        taxRate: taxRate.toDecimalPlaces(4).toString(),
        discount: discount.toDecimalPlaces(4).toString(),
        total: lineTotal.toString(),
        productId: item.productId ?? undefined,
        sortOrder: item.sortOrder ?? idx,
      };
    });
  }

  private aggregateTotals(lines: ComputedLineItem[]): InvoiceTotals {
    let subtotal = new Decimal(0),
      discountAmount = new Decimal(0),
      taxAmount = new Decimal(0),
      totalAmount = new Decimal(0);

    for (const line of lines) {
      const qty = toDecimal(line.quantity);
      const price = toDecimal(line.unitPrice);
      const taxRate = toDecimal(line.taxRate);
      const discount = toDecimal(line.discount);
      const lineBase = qty.mul(price);

      subtotal = subtotal.plus(lineBase);
      discountAmount = discountAmount.plus(lineBase.mul(discount));
      taxAmount = taxAmount.plus(lineBase.minus(lineBase.mul(discount)).mul(taxRate));
      totalAmount = totalAmount.plus(toDecimal(line.total));
    }

    return {
      subtotal: roundMoney(subtotal),
      discountAmount: roundMoney(discountAmount),
      taxAmount: roundMoney(taxAmount),
      totalAmount: roundMoney(totalAmount),
    };
  }

  private computePaymentStatus(amountPaid: Decimal, totalAmount: Decimal): PaymentStatusResult {
    return amountPaid.gte(totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
  }

  private assertTransition(from: InvoiceStatus, to: InvoiceStatus, invoiceNumber: string): void {
    const allowed = INVOICE_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Invalid transition for '${invoiceNumber}': ${from} → ${to}. ` +
          `Allowed: [${allowed.join(', ') || 'none — terminal state'}]`,
      );
    }
  }

  private async generateInvoiceNumber(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const lockKey = this.orgIdToLockKey(organizationId);
    const result = await tx.$queryRaw<[{ next_number: bigint }]>`
      SELECT pg_advisory_xact_lock(${lockKey}),
             (SELECT COUNT(*) FROM invoices WHERE organization_id = ${organizationId} AND deleted_at IS NULL) + 1 AS next_number
    `;
    const seq = Number(result[0].next_number);
    const year = new Date().getFullYear();
    return `INV-${year}-${String(seq).padStart(6, '0')}`;
  }

  private orgIdToLockKey(orgId: string): bigint {
    const h = createHash('sha256').update(orgId).digest().subarray(0, 8);
    return (BigInt('0x' + h.toString('hex')) & ((1n << 63n) - 1n)) + 1000n;
  }

  private async enqueuePdfJob(invoiceId: string, organizationId: string) {
    const payload: PdfJobPayload = { invoiceId, organizationId };
    return this.pdfQueue.add('generate', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    });
  }

  private async findOneOrFail(organizationId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId, deletedAt: null }, // FIX 5
      include: this.defaultInclude(),
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    return invoice;
  }

  // FIX 10: Include customer Contact for name/email/taxId display
  private defaultInclude() {
    return {
      lineItems: { orderBy: { sortOrder: 'asc' as const } },
      payments: { orderBy: { paidAt: 'desc' as const } },
      customer: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
          taxId: true,
          contactType: true,
          addressLine1: true,
          city: true,
          country: true,
        },
      },
    };
  }
}
