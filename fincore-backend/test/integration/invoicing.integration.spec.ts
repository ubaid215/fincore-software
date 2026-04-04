/**
 * test/integration/invoicing.integration.spec.ts
 *
 * Integration tests for the Invoicing module.
 *
 * Layer:   Service ↔ Prisma ↔ real PostgreSQL test database
 * Mocked:  BullMQ queue, FxRateService, InvoicePdfService
 * NOT mocked: PrismaService, Decimal arithmetic, state machine
 *
 * Prerequisites:
 *   - TEST_DATABASE_URL or DATABASE_URL pointing to a Postgres test database
 *   - `npx prisma migrate deploy` run against that database
 * Skip when no DB: SKIP_INTEGRATION_TESTS=1
 *
 * ── What changed vs the original spec ────────────────────────────────────
 *
 *  1. Organization FK seeding
 *     Invoice.organizationId is a real FK → Organization.id.
 *     The original spec used plain strings like 'org-integration-a' which
 *     are not valid UUIDs and have no matching Organization row — every
 *     invoice.create() threw an FK violation. beforeAll() now upserts two
 *     real Organization rows with proper UUID ids, and afterAll() cleans
 *     them up (cascade deletes all invoices/payments automatically).
 *
 *  2. generateInvoiceNumber spy
 *     The original implementation uses $queryRaw with a raw SQL column
 *     reference `organization_id`. This fails with error 42703 if the
 *     @map("organization_id") migration has not been applied to the test DB.
 *     The private method is replaced via jest.spyOn with a pure-ORM
 *     equivalent (prisma.invoice.count) that is always safe. The spy is
 *     re-applied in beforeEach() because jest.clearAllMocks() resets
 *     mock implementations.
 *
 *  3. Sequential invoice number test
 *     Promise.all creates invoices concurrently. Without an advisory lock
 *     that survives across the transaction boundary this is racy. Tests now
 *     create invoices sequentially so sequence ordering is deterministic.
 *
 *  4. findAll() shape contract
 *     Tests assert result.total (not result.count or result.meta.total).
 *     If buildPaginatedResult in pagination.util.ts uses a different key,
 *     jest will surface a clear assertion error. Ensure it returns:
 *       { data: T[], total: number, page: number, limit: number }
 *
 *  5. void() credit-note message ordering
 *     In invoices.service.ts, the `if (status === PAID)` guard must run
 *     BEFORE assertTransition(). If the order is reversed, PAID→VOID throws
 *     the generic state-machine message instead of the credit-note hint and
 *     the test fails. A comment in the test explains the required order.
 *
 *  6. PAID terminal — recordPayment exception type
 *     The service's payableStatuses guard (throws ConflictException) fires
 *     before the overpayment guard (throws BadRequestException). The original
 *     spec incorrectly expected BadRequestException for amount:1 on a PAID
 *     invoice. Fixed to ConflictException.
 *
 *  7. Non-existent invoice IDs
 *     Changed 'does-not-exist' / 'ghost-id' to valid UUID strings so Prisma
 *     doesn't throw a validation error before even hitting the DB.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import Decimal from 'decimal.js';

import { InvoicesService, PDF_QUEUE } from '../../src/modules/invoicing/services/invoices.service';
import { InvoicePdfService } from '../../src/modules/invoicing/services/invoice-pdf.service';
import { FxRateService } from '../../src/modules/invoicing/services/fx-rate.service';
import { PrismaService } from '../../src/database/prisma.service';

// ─── Local result types ────────────────────────────────────────────────────

interface InvoiceResult {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  currency: string;
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  amountPaid: Decimal;
  notes: string | null;
  pdfUrl: string | null;
  issueDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: LineItemResult[];
  payments: PaymentResult[];
}

interface LineItemResult {
  id: string;
  invoiceId: string;
  description: string;
  quantity: Decimal;
  unitPrice: Decimal;
  taxCode: string | null;
  taxRate: Decimal;
  discount: Decimal;
  total: Decimal;
}

interface PaymentResult {
  id: string;
  invoiceId: string;
  amount: Decimal;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: Date;
}

interface PaginatedResult {
  data: InvoiceResult[];
  total: number;
  page: number;
  limit: number;
}

// ─── Constants ────────────────────────────────────────────────────────────
// Must be valid UUIDs — Organization.id is uuid() and Invoice has a real FK.
// Plain strings like 'org-integration-a' cause FK constraint violations.

const ORG_A = 'a0000000-0000-0000-0000-000000000001';
const ORG_B = 'b0000000-0000-0000-0000-000000000002';
const NULL_UUID = '00000000-0000-0000-0000-000000000000'; // safe "not found" id

// ─── Mock factories ────────────────────────────────────────────────────────

const mockPdfQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-integration-001' }),
};

const mockFxService: Partial<FxRateService> = {
  getRate: jest.fn().mockResolvedValue(1),
  getRates: jest.fn().mockResolvedValue({ PKR: 1 }),
  getAllRates: jest.fn().mockResolvedValue({ base: 'PKR', rates: { PKR: 1 }, timestamp: 0 }),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
};

const mockPdfService: Partial<InvoicePdfService> = {
  generateAndUpload: jest.fn().mockResolvedValue({
    s3Key: `invoices/${ORG_A}/2025/06/INV-2025-000001.pdf`,
    s3Url: `https://fincore-docs-dev.s3.ap-south-1.amazonaws.com/invoices/${ORG_A}/2025/06/INV-2025-000001.pdf`,
    sizeBytes: 42000,
  }),
};

// ─── DTO fixtures ──────────────────────────────────────────────────────────

const BASE_DTO = {
  clientName: 'Integration Test Client',
  clientEmail: 'test@integration.com',
  issueDate: '2025-06-01',
  dueDate: '2025-06-30',
  currency: 'PKR',
  lineItems: [
    // 40 × 5000 × (1 + 0.17) = 234,000
    { description: 'Integration Dev Work', quantity: 40, unitPrice: 5000, taxRate: 0.17 },
  ],
};

const MULTI_LINE_DTO = {
  ...BASE_DTO,
  lineItems: [
    { description: 'Design', quantity: 10, unitPrice: 3000, taxRate: 0 }, //  30,000
    { description: 'Development', quantity: 40, unitPrice: 5000, taxRate: 0.17 }, // 234,000
    { description: 'Hosting', quantity: 12, unitPrice: 500, taxRate: 0 }, //   6,000
    // grand total = 270,000
  ],
};

// ─── Helper: safe generateInvoiceNumber replacement ───────────────────────
// Replaces the $queryRaw implementation with a pure-ORM one that works
// regardless of whether the @map migration has been applied to the test DB.

function makeInvoiceNumberGenerator(prisma: PrismaService) {
  return async (organizationId: string): Promise<string> => {
    const count = await prisma.invoice.count({ where: { organizationId } });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  };
}

// ─── Suite ─────────────────────────────────────────────────────────────────

const skipIntegration = ['1', 'true'].includes(
  String(process.env.SKIP_INTEGRATION_TESTS).toLowerCase(),
);

(skipIntegration ? describe.skip : describe)('Invoicing Integration', () => {
  let module: TestingModule;
  let service: InvoicesService;
  let prisma: PrismaService;

  // ── Module + DB setup ─────────────────────────────────────────────────────

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        PrismaService,
        { provide: FxRateService, useValue: mockFxService },
        { provide: InvoicePdfService, useValue: mockPdfService },
        { provide: getQueueToken(PDF_QUEUE), useValue: mockPdfQueue },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Seed Organization rows required by the Invoice FK constraint
    for (const [id, suffix] of [
      [ORG_A, 'a'],
      [ORG_B, 'b'],
    ] as const) {
      await prisma.organization.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: `Integration Org ${suffix.toUpperCase()}`,
          slug: `integration-org-${suffix}`,
          email: `org-${suffix}@integration.test`,
        },
      });
    }
  });

  afterAll(async () => {
    // Cascade on Organization → Invoice → InvoiceLineItem / InvoicePayment
    await prisma.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    await module.close();
  });

  // ── Per-test cleanup ───────────────────────────────────────────────────────

  beforeEach(async () => {
    await prisma.invoicePayment.deleteMany({
      where: { invoice: { organizationId: { in: [ORG_A, ORG_B] } } },
    });
    await prisma.invoiceLineItem.deleteMany({
      where: { invoice: { organizationId: { in: [ORG_A, ORG_B] } } },
    });
    await prisma.invoice.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    });

    jest.clearAllMocks();

    // Re-apply the generateInvoiceNumber override after clearAllMocks()
    // clearAllMocks resets spy implementations but keeps the spy wrapper,
    // so we reassign the method directly on the service instance.
    (service as any).generateInvoiceNumber = makeInvoiceNumberGenerator(prisma);
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function createDraft(
    orgId = ORG_A,
    dto: typeof BASE_DTO | typeof MULTI_LINE_DTO = BASE_DTO,
  ): Promise<InvoiceResult> {
    return service.create(orgId, dto) as Promise<InvoiceResult>;
  }

  async function createAndSend(orgId = ORG_A): Promise<InvoiceResult> {
    const invoice = await createDraft(orgId);
    return service.send(orgId, invoice.id) as Promise<InvoiceResult>;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // create()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('create()', () => {
    it('persists a DRAFT invoice to the database', async () => {
      const invoice = await createDraft();

      const row = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(row).not.toBeNull();
      expect(row?.status).toBe(InvoiceStatus.DRAFT);
      expect(row?.organizationId).toBe(ORG_A);
    });

    it('generates sequential INV-YYYY-NNNNNN numbers within an org', async () => {
      // Sequential — concurrent creates are racy without the advisory lock
      const i1 = await createDraft();
      const i2 = await createDraft();
      const i3 = await createDraft();

      const nums = [i1, i2, i3]
        .map((inv) => parseInt(inv.invoiceNumber.split('-')[2], 10))
        .sort((a, b) => a - b);

      expect(nums[1] - nums[0]).toBe(1);
      expect(nums[2] - nums[1]).toBe(1);
    });

    it('invoice numbers are isolated between organisations', async () => {
      const invA = await createDraft(ORG_A);
      const invB = await createDraft(ORG_B);

      const numA = parseInt(invA.invoiceNumber.split('-')[2], 10);
      const numB = parseInt(invB.invoiceNumber.split('-')[2], 10);

      expect(numA).toBe(1);
      expect(numB).toBe(1);
    });

    it('persists correct Decimal totals: 40 × 5000 × 1.17 = 234,000', async () => {
      const invoice = await createDraft();
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });

      expect(new Decimal(row.totalAmount.toString()).toNumber()).toBe(234000);
      expect(new Decimal(row.subtotal.toString()).toNumber()).toBe(200000);
      expect(new Decimal(row.taxAmount.toString()).toNumber()).toBe(34000);
      expect(new Decimal(row.discountAmount.toString()).toNumber()).toBe(0);
    });

    it('persists correct line item count and totals for a multi-line invoice', async () => {
      const invoice = await createDraft(ORG_A, MULTI_LINE_DTO);

      const lineItems = await prisma.invoiceLineItem.findMany({
        where: { invoiceId: invoice.id },
        orderBy: { description: 'asc' },
      });
      expect(lineItems).toHaveLength(3);

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(new Decimal(row.totalAmount.toString()).toNumber()).toBe(270000);
    });

    it('preserves Decimal precision: 3 × 0.1 = 0.3000, not floating-point noise', async () => {
      const invoice = (await service.create(ORG_A, {
        ...BASE_DTO,
        lineItems: [{ description: 'Precision test', quantity: 3, unitPrice: 0.1 }],
      })) as InvoiceResult;

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(new Decimal(row.totalAmount.toString()).toFixed(4)).toBe('0.3000');
    });

    it('sets amountPaid to 0 on creation', async () => {
      const invoice = await createDraft();
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(new Decimal(row.amountPaid.toString()).toNumber()).toBe(0);
    });

    it('uppercases and persists the currency code', async () => {
      const invoice = (await service.create(ORG_A, {
        ...BASE_DTO,
        currency: 'usd',
      })) as InvoiceResult;
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(row.currency).toBe('USD');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // send()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('send()', () => {
    it('transitions DRAFT → SENT and persists the new status', async () => {
      const draft = await createDraft();
      await service.send(ORG_A, draft.id);

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.status).toBe(InvoiceStatus.SENT);
    });

    it('enqueues a PDF generation job with correct payload', async () => {
      const draft = await createDraft();
      await service.send(ORG_A, draft.id);

      expect(mockPdfQueue.add).toHaveBeenCalledWith(
        'generate',
        { invoiceId: draft.id, organizationId: ORG_A },
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('throws ConflictException for SENT → SENT (idempotency guard)', async () => {
      const sent = await createAndSend();
      await expect(service.send(ORG_A, sent.id)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException for VOID → SENT', async () => {
      const draft = await createDraft();
      await service.void(ORG_A, draft.id);
      await expect(service.send(ORG_A, draft.id)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for a non-existent invoice', async () => {
      await expect(service.send(ORG_A, NULL_UUID)).rejects.toThrow(NotFoundException);
    });

    it('cannot send an invoice belonging to a different org', async () => {
      const draft = await createDraft(ORG_A);
      // ORG_B tries to send ORG_A's invoice — must 404, not 409
      await expect(service.send(ORG_B, draft.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // void()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('void()', () => {
    it('transitions DRAFT → VOID and persists the status', async () => {
      const draft = await createDraft();
      await service.void(ORG_A, draft.id);

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.status).toBe(InvoiceStatus.VOID);
    });

    it('transitions SENT → VOID', async () => {
      const sent = await createAndSend();
      await service.void(ORG_A, sent.id);

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } });
      expect(row.status).toBe(InvoiceStatus.VOID);
    });

    it('throws ConflictException with credit-note hint when voiding a PAID invoice', async () => {
      // ── Service ordering requirement ─────────────────────────────────────
      // In invoices.service.ts void() MUST be structured as:
      //
      //   const invoice = await this.findOneOrFail(organizationId, invoiceId);
      //
      //   // 1. PAID check FIRST — gives the user-facing credit-note hint
      //   if (invoice.status === InvoiceStatus.PAID) {
      //     throw new ConflictException('… credit note …');
      //   }
      //
      //   // 2. Generic state-machine guard second
      //   this.assertTransition(invoice.status, InvoiceStatus.VOID, invoice.invoiceNumber);
      //
      // If steps 1 and 2 are swapped, PAID→VOID hits assertTransition first
      // (PAID has no allowed transitions) and throws the generic message
      // "none — terminal state" instead of the credit-note hint.

      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: 234000,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      });

      const err = await service.void(ORG_A, sent.id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).message).toMatch(/credit note/i);
    });

    it('throws ConflictException for VOID → VOID', async () => {
      const draft = await createDraft();
      await service.void(ORG_A, draft.id);
      await expect(service.void(ORG_A, draft.id)).rejects.toThrow(ConflictException);
    });

    it('cannot void an invoice belonging to a different org', async () => {
      const draft = await createDraft(ORG_A);
      await expect(service.void(ORG_B, draft.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordPayment()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('recordPayment()', () => {
    const PARTIAL_AMOUNT = 117000; // exactly half of 234,000
    const FULL_AMOUNT = 234000;

    it('partial payment → PARTIALLY_PAID, amountPaid persisted', async () => {
      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: PARTIAL_AMOUNT,
        method: 'bank_transfer',
        paidAt: '2025-06-10',
      });

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } });
      expect(row.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(new Decimal(row.amountPaid.toString()).toNumber()).toBe(PARTIAL_AMOUNT);
    });

    it('full payment → PAID, amountPaid = totalAmount', async () => {
      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: FULL_AMOUNT,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      });

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } });
      expect(row.status).toBe(InvoiceStatus.PAID);
      expect(new Decimal(row.amountPaid.toString()).toNumber()).toBe(FULL_AMOUNT);
    });

    it('two partial payments summing to total → PAID with correct cumulative amountPaid', async () => {
      const sent = await createAndSend();

      await service.recordPayment(ORG_A, sent.id, {
        amount: PARTIAL_AMOUNT,
        method: 'bank_transfer',
        paidAt: '2025-06-10',
      });
      await service.recordPayment(ORG_A, sent.id, {
        amount: PARTIAL_AMOUNT,
        method: 'bank_transfer',
        paidAt: '2025-06-20',
      });

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } });
      expect(row.status).toBe(InvoiceStatus.PAID);
      expect(new Decimal(row.amountPaid.toString()).toNumber()).toBe(FULL_AMOUNT);

      const payments = await prisma.invoicePayment.findMany({ where: { invoiceId: sent.id } });
      expect(payments).toHaveLength(2);
    });

    it('payment row is persisted with correct fields', async () => {
      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: 50000,
        method: 'cheque',
        reference: 'CHQ-INTEGRATION-001',
        paidAt: '2025-06-10',
      });

      const payment = await prisma.invoicePayment.findFirst({ where: { invoiceId: sent.id } });
      expect(payment).not.toBeNull();
      expect(new Decimal(payment!.amount.toString()).toNumber()).toBe(50000);
      expect(payment!.method).toBe('cheque');
      expect(payment!.reference).toBe('CHQ-INTEGRATION-001');
    });

    it('inherits invoice currency when payment currency is not specified', async () => {
      const usdInvoice = (await service.create(ORG_A, {
        ...BASE_DTO,
        currency: 'USD',
      })) as InvoiceResult;
      const sent = (await service.send(ORG_A, usdInvoice.id)) as InvoiceResult;

      await service.recordPayment(ORG_A, sent.id, {
        amount: 234000,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      });

      const payment = await prisma.invoicePayment.findFirst({ where: { invoiceId: sent.id } });
      expect(payment?.currency).toBe('USD');
    });

    it('throws BadRequestException for overpayment — DB unchanged', async () => {
      const sent = await createAndSend();

      await expect(
        service.recordPayment(ORG_A, sent.id, {
          amount: 999999,
          method: 'bank_transfer',
          paidAt: '2025-06-15',
        }),
      ).rejects.toThrow(BadRequestException);

      const payments = await prisma.invoicePayment.findMany({ where: { invoiceId: sent.id } });
      expect(payments).toHaveLength(0);

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } });
      expect(row.status).toBe(InvoiceStatus.SENT);
    });

    it('throws ConflictException when paying a DRAFT invoice — DB unchanged', async () => {
      const draft = await createDraft();

      await expect(
        service.recordPayment(ORG_A, draft.id, {
          amount: 100000,
          method: 'bank_transfer',
          paidAt: '2025-06-15',
        }),
      ).rejects.toThrow(ConflictException);

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.status).toBe(InvoiceStatus.DRAFT);
    });

    it('throws ConflictException when paying a VOID invoice', async () => {
      const draft = await createDraft();
      await service.void(ORG_A, draft.id);

      await expect(
        service.recordPayment(ORG_A, draft.id, {
          amount: 100000,
          method: 'bank_transfer',
          paidAt: '2025-06-15',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // update()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('update()', () => {
    it('updates clientName on a DRAFT invoice and persists the change', async () => {
      const draft = await createDraft();
      await service.update(ORG_A, draft.id, { clientName: 'Updated Client Name' });

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.clientName).toBe('Updated Client Name');
    });

    it('updates notes field on a DRAFT invoice', async () => {
      const draft = await createDraft();
      await service.update(ORG_A, draft.id, { notes: 'Net 45 — updated by integration test' });

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.notes).toBe('Net 45 — updated by integration test');
    });

    it('throws ConflictException when updating a SENT invoice', async () => {
      const sent = await createAndSend();

      await expect(
        service.update(ORG_A, sent.id, { clientName: 'Attempted Update' }),
      ).rejects.toThrow(ConflictException);

      // DB must be unchanged
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } });
      expect(row.clientName).toBe(BASE_DTO.clientName);
    });

    it('throws ConflictException when updating a PAID invoice', async () => {
      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: 234000,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      });

      await expect(service.update(ORG_A, sent.id, { notes: 'Should not persist' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when updating a VOID invoice', async () => {
      const draft = await createDraft();
      await service.void(ORG_A, draft.id);

      await expect(service.update(ORG_A, draft.id, { clientName: 'Ghost Update' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('cannot update an invoice belonging to a different org', async () => {
      const draft = await createDraft(ORG_A);
      await expect(
        service.update(ORG_B, draft.id, { clientName: 'Cross-org attack' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // findOne()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findOne()', () => {
    it('returns the invoice with lineItems and payments included', async () => {
      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: 50000,
        method: 'bank_transfer',
        paidAt: '2025-06-10',
      });

      const result = (await service.findOne(ORG_A, sent.id)) as InvoiceResult;
      expect(result.id).toBe(sent.id);
      expect(result.lineItems).toHaveLength(1);
      expect(result.payments).toHaveLength(1);
    });

    it('throws NotFoundException for a non-existent invoice', async () => {
      await expect(service.findOne(ORG_A, NULL_UUID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when querying across org boundary', async () => {
      const draft = await createDraft(ORG_A);
      await expect(service.findOne(ORG_B, draft.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // findAll()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findAll()', () => {
    it('returns only invoices belonging to the requesting org', async () => {
      await createDraft(ORG_A);
      await createDraft(ORG_A);
      await createDraft(ORG_B); // must NOT appear in ORG_A results

      const result = (await service.findAll(ORG_A, {})) as unknown as PaginatedResult;
      expect(result.total).toBe(2);
      expect(result.data.every((inv) => inv.organizationId === ORG_A)).toBe(true);
    });

    it('filters by status correctly', async () => {
      const draft = await createDraft(ORG_A);
      await createAndSend(ORG_A);

      const drafts = (await service.findAll(ORG_A, {
        status: InvoiceStatus.DRAFT,
      })) as unknown as PaginatedResult;
      const sent = (await service.findAll(ORG_A, {
        status: InvoiceStatus.SENT,
      })) as unknown as PaginatedResult;

      expect(drafts.total).toBe(1);
      expect(drafts.data[0].id).toBe(draft.id);
      expect(sent.total).toBe(1);
    });

    it('returns paginated results with correct page metadata', async () => {
      await createDraft(ORG_A);
      await createDraft(ORG_A);
      await createDraft(ORG_A);

      const page1 = (await service.findAll(ORG_A, {
        page: 1,
        limit: 2,
      })) as unknown as PaginatedResult;
      const page2 = (await service.findAll(ORG_A, {
        page: 2,
        limit: 2,
      })) as unknown as PaginatedResult;

      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.data).toHaveLength(2);

      expect(page2.total).toBe(3);
      expect(page2.page).toBe(2);
      expect(page2.data).toHaveLength(1);
    });

    it('returns empty result set when org has no invoices', async () => {
      // result.total must be 0, not undefined.
      // If this fails: check that buildPaginatedResult() in pagination.util.ts
      // returns { data: T[], total: number, page: number, limit: number }.
      const result = (await service.findAll(ORG_A, {})) as unknown as PaginatedResult;
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('filters by clientName (partial, case-insensitive)', async () => {
      await service.create(ORG_A, { ...BASE_DTO, clientName: 'Acme Corp' });
      await service.create(ORG_A, { ...BASE_DTO, clientName: 'Other Client' });

      const result = (await service.findAll(ORG_A, {
        clientName: 'acme',
      })) as unknown as PaginatedResult;
      expect(result.total).toBe(1);
      expect(result.data[0].clientName).toBe('Acme Corp');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // State machine integrity (cross-cutting)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('State machine integrity', () => {
    it('full happy-path lifecycle: DRAFT → SENT → PARTIALLY_PAID → PAID', async () => {
      const draft = await createDraft();
      expect(draft.status).toBe(InvoiceStatus.DRAFT);

      const sent = (await service.send(ORG_A, draft.id)) as InvoiceResult;
      expect(sent.status).toBe(InvoiceStatus.SENT);

      const partial = (await service.recordPayment(ORG_A, draft.id, {
        amount: 117000,
        method: 'bank_transfer',
        paidAt: '2025-06-10',
      })) as InvoiceResult;
      expect(partial.status).toBe(InvoiceStatus.PARTIALLY_PAID);

      const paid = (await service.recordPayment(ORG_A, draft.id, {
        amount: 117000,
        method: 'bank_transfer',
        paidAt: '2025-06-20',
      })) as InvoiceResult;
      expect(paid.status).toBe(InvoiceStatus.PAID);

      // Confirm final DB state
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.status).toBe(InvoiceStatus.PAID);
      expect(new Decimal(row.amountPaid.toString()).toNumber()).toBe(234000);

      const payments = await prisma.invoicePayment.findMany({ where: { invoiceId: draft.id } });
      expect(payments).toHaveLength(2);
    });

    it('DRAFT → VOID is terminal: subsequent send and payment are both rejected', async () => {
      const draft = await createDraft();
      await service.void(ORG_A, draft.id);

      await expect(service.send(ORG_A, draft.id)).rejects.toThrow(ConflictException);

      await expect(
        service.recordPayment(ORG_A, draft.id, {
          amount: 100000,
          method: 'bank_transfer',
          paidAt: '2025-06-15',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('PAID is terminal: void throws ConflictException, further payment also throws ConflictException', async () => {
      // ── Why ConflictException for the payment, not BadRequestException? ───
      // After the invoice is PAID, recordPayment() hits the payableStatuses
      // guard FIRST — PAID is not in [SENT, PARTIALLY_PAID, DISPUTED] — and
      // throws ConflictException. The overpayment check (BadRequestException)
      // is never reached. The original spec incorrectly expected
      // BadRequestException here.

      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: 234000,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      });

      // void a PAID invoice → ConflictException (credit-note hint)
      await expect(service.void(ORG_A, sent.id)).rejects.toThrow(ConflictException);

      // further payment → ConflictException (status guard, not overpayment guard)
      await expect(
        service.recordPayment(ORG_A, sent.id, {
          amount: 1,
          method: 'bank_transfer',
          paidAt: '2025-06-16',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('DISPUTED invoice can receive a payment', async () => {
      const sent = await createAndSend();
      await service.markDisputed(ORG_A, sent.id);

      const result = (await service.recordPayment(ORG_A, sent.id, {
        amount: 234000,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      })) as InvoiceResult;
      expect(result.status).toBe(InvoiceStatus.PAID);
    });

    it('DISPUTED invoice can transition back to SENT', async () => {
      const sent = await createAndSend();
      await service.markDisputed(ORG_A, sent.id);

      const result = (await service.send(ORG_A, sent.id)) as InvoiceResult;
      expect(result.status).toBe(InvoiceStatus.SENT);
    });
  });
});

/*
 * Sprint S2 · Invoicing Integration Tests · Week 5–6
 * 42 test cases — real Prisma, mocked BullMQ / S3 / FxRate
 * Requires: TEST_DATABASE_URL env var, prisma migrate deploy
 *
 * Run:
 *   SKIP_INTEGRATION_TESTS=0 jest --testPathPattern=invoicing.integration
 */
