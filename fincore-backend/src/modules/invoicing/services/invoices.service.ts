/**
 * src/modules/invoicing/services/invoices.service.ts
 *
 * ── Fixes in this version ────────────────────────────────────────────────
 *
 *  1. void() — PAID guard now runs BEFORE assertTransition()
 *     Previously the PAID check came after assertTransition(), which means
 *     PAID→VOID would throw the generic "none — terminal state" message
 *     instead of the user-facing credit-note hint. Correct order:
 *       findOneOrFail → PAID check → assertTransition → update
 *
 *  2. generateInvoiceNumber — raw SQL moved inside $transaction
 *     pg_advisory_xact_lock is transaction-scoped. Calling it outside a
 *     transaction means the lock is immediately released, making the
 *     advisory-lock protection useless under concurrent load.
 *     The method now accepts an optional transaction client and the lock +
 *     count query run inside the same transaction as the invoice.create().
 *     The raw SQL also now explicitly references `organization_id` which
 *     matches the @map("organization_id") annotation added to the Prisma
 *     schema — without that annotation the column name is ambiguous and
 *     Postgres returned error 42703.
 *
 *  3. recurringPeriod — DTO field is typed as string | undefined, but the
 *     Prisma schema expects RecurringPeriod enum | null. Cast via
 *     `as RecurringPeriod` to satisfy TS without changing runtime behaviour
 *     (the DTO is validated by class-validator @IsEnum before reaching here).
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { InvoiceStatus, RecurringPeriod } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FxRateService } from './fx-rate.service';
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
    @InjectQueue(PDF_QUEUE) private readonly pdfQueue: Queue,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(organizationId: string, dto: CreateInvoiceDto) {
    const currency = (dto.currency ?? 'PKR').toUpperCase();

    const computedLines = this.computeLineItems(dto.lineItems);
    const totals = this.aggregateTotals(computedLines);

    // generateInvoiceNumber now runs INSIDE the transaction so the advisory
    // lock spans the same transaction as the INSERT, making it safe under
    // concurrent load (lock released when the tx commits/rolls back).
    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(organizationId, tx);

      return tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          clientName: dto.clientName,
          clientEmail: dto.clientEmail ?? null,
          clientAddress: dto.clientAddress ?? null,
          issueDate: new Date(dto.issueDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          currency,
          subtotal: totals.subtotal.toString(),
          taxAmount: totals.taxAmount.toString(),
          discountAmount: totals.discountAmount.toString(),
          totalAmount: totals.totalAmount.toString(),
          amountPaid: '0',
          // amountDue = totalAmount on creation (nothing paid yet)
          amountDue: totals.totalAmount.toString(),
          notes: dto.notes ?? null,
          isRecurring: dto.isRecurring ?? false,
          // FIX: DTO field is `string | undefined`; Prisma expects
          // `RecurringPeriod | null`. The DTO is @IsEnum-validated upstream
          // so the cast is safe at runtime.
          recurringPeriod: (dto.recurringPeriod as RecurringPeriod) ?? null,
          status: InvoiceStatus.DRAFT,
          lineItems: { create: computedLines },
        },
        include: this.defaultInclude(),
      });
    });

    this.logger.log(`Invoice ${invoice.invoiceNumber} created (org: ${organizationId})`);
    return invoice;
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async findAll(
    organizationId: string,
    query: QueryInvoicesDto,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit });

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency.toUpperCase() } : {}),
      ...(query.clientName
        ? { clientName: { contains: query.clientName, mode: 'insensitive' } }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            issueDate: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.overdueOnly
        ? {
            dueDate: { lt: new Date() },
            status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] },
          }
        : {}),
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

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(organizationId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(
        `Only DRAFT invoices can be edited. Invoice '${invoice.invoiceNumber}' is ${invoice.status}.`,
      );
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(dto.clientName ? { clientName: dto.clientName } : {}),
        ...(dto.clientEmail ? { clientEmail: dto.clientEmail } : {}),
        ...(dto.clientAddress ? { clientAddress: dto.clientAddress } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: this.defaultInclude(),
    });
  }

  // ─── State transitions ────────────────────────────────────────────────────

  async send(organizationId: string, invoiceId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);
    this.assertTransition(invoice.status, InvoiceStatus.SENT, invoice.invoiceNumber);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.SENT },
      include: this.defaultInclude(),
    });

    await this.enqueuePdfJob(invoiceId, organizationId);
    this.logger.log(`Invoice ${invoice.invoiceNumber} sent → PDF job enqueued`);
    return updated;
  }

  async markDisputed(organizationId: string, invoiceId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);
    this.assertTransition(invoice.status, InvoiceStatus.DISPUTED, invoice.invoiceNumber);

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.DISPUTED },
      include: this.defaultInclude(),
    });
  }

  async void(organizationId: string, invoiceId: string) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    // ── PAID guard FIRST ──────────────────────────────────────────────────
    // Must come before assertTransition(). If reversed, PAID→VOID hits
    // assertTransition first (PAID has no transitions) and throws the generic
    // "none — terminal state" message instead of the user-facing credit-note
    // hint. The integration test 'throws ConflictException with credit-note
    // hint when voiding a PAID invoice' verifies this ordering.
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        `Invoice '${invoice.invoiceNumber}' is PAID and cannot be voided. Issue a credit note instead.`,
      );
    }

    // Generic state-machine guard (catches VOID→VOID and other bad transitions)
    this.assertTransition(invoice.status, InvoiceStatus.VOID, invoice.invoiceNumber);

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.VOID },
      include: this.defaultInclude(),
    });
  }

  // ─── Record payment ───────────────────────────────────────────────────────

  async recordPayment(organizationId: string, invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await this.findOneOrFail(organizationId, invoiceId);

    const payableStatuses: InvoiceStatus[] = [
      InvoiceStatus.SENT,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.DISPUTED,
    ];

    if (!payableStatuses.includes(invoice.status)) {
      throw new ConflictException(
        `Cannot record payment on invoice '${invoice.invoiceNumber}' — status is ${invoice.status}.`,
      );
    }

    const paymentAmount = toDecimal(dto.amount);
    const totalAmount = toDecimal(invoice.totalAmount.toString());
    const alreadyPaid = toDecimal(invoice.amountPaid.toString());
    const outstanding = totalAmount.minus(alreadyPaid);

    if (paymentAmount.gt(outstanding)) {
      throw new BadRequestException(
        `Payment amount exceeds outstanding balance (${invoice.currency} ${outstanding.toFixed(2)}).`,
      );
    }

    const newAmountPaid = roundMoney(alreadyPaid.plus(paymentAmount));
    const newAmountDue = roundMoney(totalAmount.minus(newAmountPaid));
    const newStatus = this.computePaymentStatus(newAmountPaid, totalAmount);

    return this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: paymentAmount.toString(),
          currency: (dto.currency ?? invoice.currency).toUpperCase(),
          method: dto.method,
          reference: dto.reference ?? null,
          paidAt: new Date(dto.paidAt),
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid.toString(),
          amountDue: newAmountDue.toString(),
          status: newStatus,
        },
        include: this.defaultInclude(),
      });

      this.logger.log(
        `Payment of ${dto.amount} recorded on ${invoice.invoiceNumber} → status: ${newStatus}`,
      );

      return updated;
    });
  }

  // ─── FX helper ────────────────────────────────────────────────────────────

  async convertToOrganizationCurrency(
    amount: number | string,
    fromCurrency: string,
    toCurrency = 'PKR',
  ): Promise<Decimal> {
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return toDecimal(amount);
    }

    const fromRate = await this.fxService.getRate(fromCurrency);
    const toRate = await this.fxService.getRate(toCurrency);

    return roundMoney(toDecimal(amount).mul(fromRate).div(toRate));
  }

  // ─── PDF queue ────────────────────────────────────────────────────────────

  async regeneratePdf(
    organizationId: string,
    invoiceId: string,
  ): Promise<{ jobId: string | number | undefined }> {
    await this.findOneOrFail(organizationId, invoiceId);
    const job = await this.enqueuePdfJob(invoiceId, organizationId);
    return { jobId: job.id };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private computeLineItems(items: CreateInvoiceDto['lineItems']): ComputedLineItem[] {
    return items.map((item) => {
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
      };
    });
  }

  private aggregateTotals(lines: ComputedLineItem[]): InvoiceTotals {
    let subtotal = new Decimal(0);
    let discountAmount = new Decimal(0);
    let taxAmount = new Decimal(0);
    let totalAmount = new Decimal(0);

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
        `Invalid state transition for invoice '${invoiceNumber}': ` +
          `${from} → ${to} is not allowed. ` +
          `Allowed transitions from ${from}: [${allowed.join(', ') || 'none — terminal state'}]`,
      );
    }
  }

  /**
   * Generate the next sequential invoice number for the given org.
   *
   * Runs inside a Prisma interactive transaction (tx) so that the
   * pg_advisory_xact_lock is held for the duration of the INSERT — the lock
   * is automatically released when the transaction commits or rolls back.
   *
   * Requires the @map("organization_id") annotation on Invoice.organizationId
   * in the Prisma schema (and the corresponding migration) so that the raw
   * SQL column reference matches the actual DB column name.
   *
   * @param organizationId  The org whose invoice sequence to advance.
   * @param tx              The active Prisma transaction client.
   */
  private async generateInvoiceNumber(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const lockKey = this.orgIdToLockKey(organizationId);

    const result = await tx.$queryRaw<[{ next_number: bigint }]>`
      SELECT pg_advisory_xact_lock(${lockKey}),
             (SELECT COUNT(*) FROM invoices WHERE organization_id = ${organizationId}) + 1 AS next_number
    `;

    const seq = Number(result[0].next_number);
    const year = new Date().getFullYear();
    return `INV-${year}-${String(seq).padStart(6, '0')}`;
  }

  /** Stable 63-bit advisory lock key derived from any org id string. */
  private orgIdToLockKey(orgId: string): bigint {
    const h = createHash('sha256').update(orgId).digest().subarray(0, 8);
    return (BigInt('0x' + h.toString('hex')) & ((1n << 63n) - 1n)) + 1000n;
  }

  private async enqueuePdfJob(invoiceId: string, organizationId: string) {
    const payload: PdfJobPayload = { invoiceId, organizationId };
    const job = await this.pdfQueue.add('generate', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    });
    this.logger.debug(`PDF job ${String(job.id)} enqueued for invoice ${invoiceId}`);
    return job;
  }

  private async findOneOrFail(organizationId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: this.defaultInclude(),
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found in this organization`);
    }

    return invoice;
  }

  private defaultInclude() {
    return {
      lineItems: { orderBy: { id: 'asc' as const } },
      payments: { orderBy: { paidAt: 'desc' as const } },
    };
  }
}
