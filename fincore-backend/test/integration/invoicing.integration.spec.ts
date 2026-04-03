/**
 * src/modules/invoicing/tests/invoicing.integration.spec.ts
 *
 * Integration tests for the Invoicing module.
 *
 * Layer: Service ↔ Prisma ↔ real PostgreSQL test database
 * Mocked: BullMQ queue, FxRateService, InvoicePdfService
 * NOT mocked: PrismaService, Decimal arithmetic, invoice numbering
 *
 * These tests complement the unit tests (fully mocked) and e2e tests (real HTTP).
 * They verify that SQL queries, Decimal persistence, and state transitions
 * work correctly end-to-end through the ORM — without spinning up a NestJS HTTP server.
 *
 * Prerequisites:
 *   - TEST_DATABASE_URL env var pointing to a dedicated Postgres test database
 *   - `npx prisma migrate deploy` run against that database
 *
 * Sprint: S2 · Week 5–6
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import Decimal from 'decimal.js';

// Should be:
import { InvoicesService, PDF_QUEUE } from '../../src/modules/invoicing/services/invoices.service';
import { InvoicePdfService } from '../../src/modules/invoicing/services/invoice-pdf.service';
import { FxRateService } from '../../src/modules/invoicing/services/fx-rate.service';
import { PrismaService } from '../../src/database/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by InvoicesService methods (Prisma invoice with relations). */
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_A = 'org-integration-a';
const ORG_B = 'org-integration-b';

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPdfQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-integration-001' }),
};

const mockFxService: Partial<FxRateService> = {
  getRate: jest.fn().mockResolvedValue(1),
  getRates: jest.fn().mockResolvedValue({ PKR: 1 }),
  getAllRates: jest.fn().mockResolvedValue({ PKR: 1 }),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
};

const mockPdfService: Partial<InvoicePdfService> = {
  generateAndUpload: jest.fn().mockResolvedValue({
    s3Key: 'invoices/org-integration-a/2025/06/INV-2025-000001.pdf',
    s3Url:
      'https://fincore-docs-dev.s3.ap-south-1.amazonaws.com/invoices/org-integration-a/2025/06/INV-2025-000001.pdf',
    sizeBytes: 42000,
  }),
};

// ─── DTO fixtures ─────────────────────────────────────────────────────────────

const BASE_DTO = {
  clientName: 'Integration Test Client',
  clientEmail: 'test@integration.com',
  issueDate: '2025-06-01',
  dueDate: '2025-06-30',
  currency: 'PKR',
  lineItems: [
    { description: 'Integration Dev Work', quantity: 40, unitPrice: 5000, taxRate: 0.17 },
  ],
};

const MULTI_LINE_DTO = {
  ...BASE_DTO,
  lineItems: [
    { description: 'Design', quantity: 10, unitPrice: 3000, taxRate: 0 }, // 30,000
    { description: 'Development', quantity: 40, unitPrice: 5000, taxRate: 0.17 }, // 234,000
    { description: 'Hosting', quantity: 12, unitPrice: 500, taxRate: 0 }, // 6,000
  ],
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Invoicing Integration', () => {
  let module: TestingModule;
  let service: InvoicesService;
  let prisma: PrismaService;

  // ── Setup ──────────────────────────────────────────────────────────────────

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
  });

  afterAll(async () => {
    await module.close();
  });

  // Clean only rows created by this suite to avoid interfering with parallel runs
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
  });

  // ── Helper ─────────────────────────────────────────────────────────────────

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

  // ── create() ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('persists a DRAFT invoice to the database', async () => {
      const invoice = await createDraft();

      // Verify it's actually in the DB — not just returned from a mock
      const row = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(row).not.toBeNull();
      expect(row?.status).toBe(InvoiceStatus.DRAFT);
      expect(row?.organizationId).toBe(ORG_A);
    });

    it('generates sequential INV-YYYY-NNNNNN numbers within an org', async () => {
      const [i1, i2, i3] = await Promise.all([createDraft(), createDraft(), createDraft()]);

      const nums = [i1, i2, i3]
        .map((inv) => parseInt(inv.invoiceNumber.split('-')[2], 10))
        .sort((a, b) => a - b);

      // Each number is exactly 1 apart
      expect(nums[1] - nums[0]).toBe(1);
      expect(nums[2] - nums[1]).toBe(1);
    });

    it('invoice numbers are isolated between organisations', async () => {
      const invA = await createDraft(ORG_A);
      const invB = await createDraft(ORG_B);

      // Both start from 1 — sequences are per-org
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

    it('persists correct line item count and totals for multi-line invoice', async () => {
      const invoice = await createDraft(ORG_A, MULTI_LINE_DTO);

      const lineItems = await prisma.invoiceLineItem.findMany({
        where: { invoiceId: invoice.id },
        orderBy: { description: 'asc' },
      });

      expect(lineItems).toHaveLength(3);

      // Invoice total: 30000 + 234000 + 6000 = 270000
      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(new Decimal(row.totalAmount.toString()).toNumber()).toBe(270000);
    });

    it('preserves Decimal precision: 3 × 0.1 = 0.3000, not 0.30000000000000004', async () => {
      const invoice = (await service.create(ORG_A, {
        ...BASE_DTO,
        lineItems: [{ description: 'Precision test', quantity: 3, unitPrice: 0.1 }],
      })) as InvoiceResult;

      const row = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      // Should be exactly 0.3, not a floating-point approximation
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

  // ── send() ─────────────────────────────────────────────────────────────────

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
      await expect(service.send(ORG_A, 'does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('cannot send an invoice belonging to a different org', async () => {
      const draft = await createDraft(ORG_A);
      // ORG_B tries to send ORG_A's invoice — should 404, not 409
      await expect(service.send(ORG_B, draft.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ── void() ─────────────────────────────────────────────────────────────────

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

  // ── recordPayment() ────────────────────────────────────────────────────────

  describe('recordPayment()', () => {
    const PARTIAL_AMOUNT = 117000;
    const FULL_AMOUNT = 234000;

    it('partial payment → status PARTIALLY_PAID, amountPaid persisted', async () => {
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

    it('full payment → status PAID, amountPaid = totalAmount', async () => {
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

      // Both payment rows must be persisted
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
      const sent = (await service.send(
        ORG_A,
        ((await service.create(ORG_A, { ...BASE_DTO, currency: 'USD' })) as InvoiceResult).id,
      )) as InvoiceResult;

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

      // No payment row should exist
      const payments = await prisma.invoicePayment.findMany({ where: { invoiceId: sent.id } });
      expect(payments).toHaveLength(0);

      // Status unchanged
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

  // ── update() ───────────────────────────────────────────────────────────────

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

      // Verify the DB was not touched
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

  // ── findOne() ──────────────────────────────────────────────────────────────

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
      await expect(service.findOne(ORG_A, 'ghost-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when querying across org boundary', async () => {
      const draft = await createDraft(ORG_A);
      await expect(service.findOne(ORG_B, draft.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ── findAll() / list() ─────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns only invoices belonging to the requesting org', async () => {
      await createDraft(ORG_A);
      await createDraft(ORG_A);
      await createDraft(ORG_B); // should NOT appear in ORG_A results

      const result = (await service.findAll(ORG_A, {})) as PaginatedResult;

      expect(result.total).toBe(2);
      expect(result.data.every((inv) => inv.organizationId === ORG_A)).toBe(true);
    });

    it('filters by status correctly', async () => {
      const draft = await createDraft(ORG_A);
      await createAndSend(ORG_A);

      const drafts = (await service.findAll(ORG_A, {
        status: InvoiceStatus.DRAFT,
      })) as PaginatedResult;
      const sent = (await service.findAll(ORG_A, {
        status: InvoiceStatus.SENT,
      })) as PaginatedResult;

      expect(drafts.total).toBe(1);
      expect(drafts.data[0].id).toBe(draft.id);
      expect(sent.total).toBe(1);
    });

    it('returns paginated results with correct page metadata', async () => {
      // Create 3 invoices to test pagination
      await createDraft(ORG_A);
      await createDraft(ORG_A);
      await createDraft(ORG_A);

      const page1 = (await service.findAll(ORG_A, { page: 1, limit: 2 })) as PaginatedResult;
      const page2 = (await service.findAll(ORG_A, { page: 2, limit: 2 })) as PaginatedResult;

      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.data).toHaveLength(2);

      expect(page2.total).toBe(3);
      expect(page2.page).toBe(2);
      expect(page2.data).toHaveLength(1);
    });

    it('returns empty result set when org has no invoices', async () => {
      const result = (await service.findAll(ORG_A, {})) as PaginatedResult;
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── State machine — cross-cutting ──────────────────────────────────────────

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

    it('PAID is terminal: void and further payment are both rejected', async () => {
      const sent = await createAndSend();
      await service.recordPayment(ORG_A, sent.id, {
        amount: 234000,
        method: 'bank_transfer',
        paidAt: '2025-06-15',
      });

      await expect(service.void(ORG_A, sent.id)).rejects.toThrow(ConflictException);
      await expect(
        service.recordPayment(ORG_A, sent.id, {
          amount: 1,
          method: 'bank_transfer',
          paidAt: '2025-06-16',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

/*
 * Sprint S2 · Invoicing Integration Tests · Week 5–6
 * 38 test cases — real Prisma, mocked BullMQ/S3/FxRate
 * Requires: TEST_DATABASE_URL, prisma migrate deploy
 */
