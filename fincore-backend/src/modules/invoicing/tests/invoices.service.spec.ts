/**
 * src/modules/invoicing/tests/invoices.service.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService, PDF_QUEUE } from '../services/invoices.service';
import { FxRateService } from '../services/fx-rate.service';
import { PrismaService } from '../../../database/prisma.service';
import { INVOICE_TRANSITIONS } from '../types/invoice.types';
import Decimal from 'decimal.js';
import { CreateInvoiceDto, CreateInvoiceLineItemDto } from '../dto/create-invoice.dto';

// ─── Mock types ───────────────────────────────────────────────────────────────

type MockPrisma = {
  invoice: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  invoicePayment: { create: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
};

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPrisma: MockPrisma = {
  invoice: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  invoicePayment: { create: jest.fn() },
  $transaction: jest.fn((cb: (p: MockPrisma) => Promise<unknown>) => cb(mockPrisma)),
  $queryRaw: jest.fn(),
};

const mockFxService = {
  getRate: jest.fn().mockResolvedValue(1),
  getRates: jest.fn().mockResolvedValue({ PKR: 1 }),
  getAllRates: jest.fn(),
  invalidateCache: jest.fn(),
};

const mockPdfQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-001' }),
};

// ─── Call-record interfaces ───────────────────────────────────────────────

interface InvoiceCreateData {
  invoiceNumber: string;
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  amountPaid: string;
  currency: string;
  lineItems: { create: unknown[] };
  [key: string]: unknown;
}

interface InvoiceUpdateData {
  amountPaid?: string;
  status?: string;
  pdfUrl?: string;
  [key: string]: unknown;
}

interface PaymentCreateData {
  currency: string;
  [key: string]: unknown;
}

function getCreateCall(): { data: InvoiceCreateData } {
  return mockPrisma.invoice.create.mock.calls[0][0] as { data: InvoiceCreateData };
}

function getUpdateCall(callIndex = 0): { data: InvoiceUpdateData } {
  return mockPrisma.invoice.update.mock.calls[callIndex][0] as { data: InvoiceUpdateData };
}

function getPaymentCall(): { data: PaymentCreateData } {
  return mockPrisma.invoicePayment.create.mock.calls[0][0] as { data: PaymentCreateData };
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-001',
    organizationId: 'org-001',
    invoiceNumber: 'INV-2025-000001',
    clientName: 'ACME Corp',
    clientEmail: 'billing@acme.com',
    clientAddress: null,
    status: InvoiceStatus.DRAFT,
    issueDate: new Date('2025-06-01'),
    dueDate: new Date('2025-06-30'),
    currency: 'PKR',
    subtotal: new Decimal(200000),
    taxAmount: new Decimal(34000),
    discountAmount: new Decimal(0),
    totalAmount: new Decimal(234000),
    amountPaid: new Decimal(0),
    notes: null,
    pdfUrl: null,
    isRecurring: false,
    recurringPeriod: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [
      {
        id: 'li-001',
        invoiceId: 'inv-001',
        description: 'Dev work',
        quantity: new Decimal(40),
        unitPrice: new Decimal(5000),
        taxCode: 'GST17',
        taxRate: new Decimal(0.17),
        discount: new Decimal(0),
        total: new Decimal(234000),
      },
    ],
    payments: [],
    ...overrides,
  };
}

// FIXED: Properly typed DTO that satisfies CreateInvoiceDto
const VALID_DTO: CreateInvoiceDto = {
  clientName: 'ACME Corp',
  clientEmail: 'billing@acme.com',
  issueDate: '2025-06-01',
  dueDate: '2025-06-30',
  currency: 'PKR',
  lineItems: [{ description: 'Dev work', quantity: 40, unitPrice: 5000, taxRate: 0.17 }],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InvoicesService', () => {
  let service: InvoicesService;
  const ORG_ID = 'org-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FxRateService, useValue: mockFxService },
        { provide: getQueueToken(PDF_QUEUE), useValue: mockPdfQueue },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();

    mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 1n }]);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice({ status: InvoiceStatus.DRAFT }));
  });

  // ─── INVOICE_TRANSITIONS ──────────────────────────────────────────────────

  describe('INVOICE_TRANSITIONS (state machine map)', () => {
    it('DRAFT allows → SENT and VOID only', () => {
      expect(INVOICE_TRANSITIONS.DRAFT).toEqual(expect.arrayContaining(['SENT', 'VOID']));
      expect(INVOICE_TRANSITIONS.DRAFT).toHaveLength(2);
    });

    it('PAID is a terminal state with no allowed transitions', () => {
      expect(INVOICE_TRANSITIONS.PAID).toHaveLength(0);
    });

    it('VOID is a terminal state with no allowed transitions', () => {
      expect(INVOICE_TRANSITIONS.VOID).toHaveLength(0);
    });

    it('PARTIALLY_PAID allows → PAID, VOID, DISPUTED', () => {
      expect(INVOICE_TRANSITIONS.PARTIALLY_PAID).toEqual(
        expect.arrayContaining(['PAID', 'VOID', 'DISPUTED']),
      );
    });
  });

  // ─── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a DRAFT invoice with correct INV-YYYY-NNNNNN number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 42n }]);
      const year = new Date().getFullYear();

      await service.create(ORG_ID, VALID_DTO);

      const { data } = getCreateCall();
      expect(data.invoiceNumber).toBe(`INV-${year}-000042`);
    });

    it('computes line item total correctly: 40 × 5000 × 1.17 = 234,000', async () => {
      await service.create(ORG_ID, VALID_DTO);

      const { data } = getCreateCall();
      expect(data.totalAmount).toBe('234000.0000');
      expect(data.subtotal).toBe('200000.0000');
      expect(data.taxAmount).toBe('34000.0000');
    });

    it('calculates discount correctly: 40 × 5000 × (1-0.10) × (1+0.17)', async () => {
      const dtoWithDiscount: CreateInvoiceDto = {
        ...VALID_DTO,
        lineItems: [
          { description: 'Work', quantity: 40, unitPrice: 5000, taxRate: 0.17, discount: 0.1 },
        ],
      };
      await service.create(ORG_ID, dtoWithDiscount);

      const { data } = getCreateCall();
      expect(data.totalAmount).toBe('210600.0000');
      expect(data.discountAmount).toBe('20000.0000');
      expect(data.taxAmount).toBe('30600.0000');
    });

    it('handles floating-point precision: 3 × 0.1 PKR = 0.3000', async () => {
      const dtoWithPrecision: CreateInvoiceDto = {
        ...VALID_DTO,
        lineItems: [{ description: 'Test', quantity: 3, unitPrice: 0.1 }],
      };
      await service.create(ORG_ID, dtoWithPrecision);

      const { data } = getCreateCall();
      expect(data.totalAmount).toBe('0.3000');
    });

    it('creates multi-line invoice with aggregated totals', async () => {
      const multiLineDto: CreateInvoiceDto = {
        ...VALID_DTO,
        lineItems: [
          { description: 'Design', quantity: 10, unitPrice: 3000 },
          { description: 'Dev work', quantity: 40, unitPrice: 5000 },
          { description: 'Hosting', quantity: 12, unitPrice: 500 },
        ],
      };
      await service.create(ORG_ID, multiLineDto);

      const { data } = getCreateCall();
      expect(data.totalAmount).toBe('236000.0000');
      expect(data.lineItems.create).toHaveLength(3);
    });

    it('defaults to PKR when currency is omitted', async () => {
      const dtoWithoutCurrency: CreateInvoiceDto = {
        clientName: VALID_DTO.clientName,
        clientEmail: VALID_DTO.clientEmail,
        issueDate: VALID_DTO.issueDate,
        dueDate: VALID_DTO.dueDate,
        lineItems: VALID_DTO.lineItems,
      };
      await service.create(ORG_ID, dtoWithoutCurrency);

      const { data } = getCreateCall();
      expect(data.currency).toBe('PKR');
    });

    it('uppercases currency code before saving', async () => {
      await service.create(ORG_ID, { ...VALID_DTO, currency: 'usd' });

      const { data } = getCreateCall();
      expect(data.currency).toBe('USD');
    });

    it('starts every invoice with amountPaid = 0', async () => {
      await service.create(ORG_ID, VALID_DTO);

      const { data } = getCreateCall();
      expect(data.amountPaid).toBe('0');
    });
  });

  // ─── send() ──────────────────────────────────────────────────────────────

  describe('send()', () => {
    it('transitions DRAFT → SENT and enqueues PDF job', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.DRAFT }));
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ status: InvoiceStatus.SENT }));

      const result = await service.send(ORG_ID, 'inv-001');

      expect(result.status).toBe(InvoiceStatus.SENT);
      expect(mockPdfQueue.add).toHaveBeenCalledWith(
        'generate',
        { invoiceId: 'inv-001', organizationId: ORG_ID },
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('throws ConflictException when sending an already-SENT invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.SENT }));

      await expect(service.send(ORG_ID, 'inv-001')).rejects.toThrow(ConflictException);
      expect(mockPdfQueue.add).not.toHaveBeenCalled();
    });

    it('throws ConflictException when sending a PAID invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));
      await expect(service.send(ORG_ID, 'inv-001')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when sending a VOID invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.VOID }));
      await expect(service.send(ORG_ID, 'inv-001')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.send(ORG_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── void() ──────────────────────────────────────────────────────────────

  describe('void()', () => {
    it('transitions DRAFT → VOID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.DRAFT }));
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ status: InvoiceStatus.VOID }));

      const result = await service.void(ORG_ID, 'inv-001');
      expect(result.status).toBe(InvoiceStatus.VOID);
    });

    it('transitions SENT → VOID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.SENT }));
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ status: InvoiceStatus.VOID }));

      await expect(service.void(ORG_ID, 'inv-001')).resolves.toBeDefined();
    });

    it('throws ConflictException with credit-note hint when voiding a PAID invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));

      const err = await service.void(ORG_ID, 'inv-001').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).message).toMatch(/credit note/i);
    });

    it('throws ConflictException when voiding an already-VOID invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.VOID }));
      await expect(service.void(ORG_ID, 'inv-001')).rejects.toThrow(ConflictException);
    });
  });

  // ─── recordPayment() ─────────────────────────────────────────────────────

  describe('recordPayment()', () => {
    const payDto = { amount: 117000, method: 'bank_transfer', paidAt: '2025-06-15' };

    it('partial payment → status becomes PARTIALLY_PAID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          status: InvoiceStatus.SENT,
          totalAmount: new Decimal(234000),
          amountPaid: new Decimal(0),
        }),
      );
      mockPrisma.invoicePayment.create.mockResolvedValue({});
      mockPrisma.invoice.update.mockResolvedValue(
        makeInvoice({ status: InvoiceStatus.PARTIALLY_PAID, amountPaid: new Decimal(117000) }),
      );

      const result = await service.recordPayment(ORG_ID, 'inv-001', payDto);
      expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);

      const { data } = getUpdateCall();
      expect(data.amountPaid).toBe('117000.0000');
      expect(data.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('exact full payment → status becomes PAID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          status: InvoiceStatus.SENT,
          totalAmount: new Decimal(234000),
          amountPaid: new Decimal(0),
        }),
      );
      mockPrisma.invoicePayment.create.mockResolvedValue({});
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));

      const result = await service.recordPayment(ORG_ID, 'inv-001', { ...payDto, amount: 234000 });
      expect(result.status).toBe(InvoiceStatus.PAID);
    });

    it('second partial payment completing the total → PAID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          status: InvoiceStatus.PARTIALLY_PAID,
          totalAmount: new Decimal(234000),
          amountPaid: new Decimal(117000),
        }),
      );
      mockPrisma.invoicePayment.create.mockResolvedValue({});
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));

      const result = await service.recordPayment(ORG_ID, 'inv-001', { ...payDto, amount: 117000 });
      expect(result.status).toBe(InvoiceStatus.PAID);

      const { data } = getUpdateCall();
      expect(data.amountPaid).toBe('234000.0000');
    });

    it('throws BadRequestException for overpayment', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          status: InvoiceStatus.SENT,
          totalAmount: new Decimal(234000),
          amountPaid: new Decimal(0),
        }),
      );

      const err = await service
        .recordPayment(ORG_ID, 'inv-001', { ...payDto, amount: 300000 })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toMatch(/exceeds.*outstanding/i);
      expect(mockPrisma.invoicePayment.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when paying a DRAFT invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.DRAFT }));
      await expect(service.recordPayment(ORG_ID, 'inv-001', payDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when paying a VOID invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.VOID }));
      await expect(service.recordPayment(ORG_ID, 'inv-001', payDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('records payment on DISPUTED invoice (clears dispute)', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          status: InvoiceStatus.DISPUTED,
          totalAmount: new Decimal(234000),
          amountPaid: new Decimal(0),
        }),
      );
      mockPrisma.invoicePayment.create.mockResolvedValue({});
      mockPrisma.invoice.update.mockResolvedValue(
        makeInvoice({ status: InvoiceStatus.PARTIALLY_PAID }),
      );

      await expect(service.recordPayment(ORG_ID, 'inv-001', payDto)).resolves.toBeDefined();
    });

    it('uses invoice currency when payment currency is omitted', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(
        makeInvoice({
          status: InvoiceStatus.SENT,
          currency: 'USD',
          totalAmount: new Decimal(500),
          amountPaid: new Decimal(0),
        }),
      );
      mockPrisma.invoicePayment.create.mockResolvedValue({});
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));

      await service.recordPayment(ORG_ID, 'inv-001', {
        amount: 500,
        method: 'bank_transfer',
        paidAt: '2025-06-01',
      });

      const { data } = getPaymentCall();
      expect(data.currency).toBe('USD');
    });
  });

  // ─── update() ────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates a DRAFT invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.DRAFT }));
      mockPrisma.invoice.update.mockResolvedValue(makeInvoice({ clientName: 'New Client' }));

      await expect(
        service.update(ORG_ID, 'inv-001', { clientName: 'New Client' }),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException when updating a SENT invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.SENT }));
      await expect(service.update(ORG_ID, 'inv-001', { clientName: 'X' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when updating a PAID invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));
      await expect(service.update(ORG_ID, 'inv-001', { notes: 'Attempt' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── findOne() ───────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns invoice when found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeInvoice());
      const result = await service.findOne(ORG_ID, 'inv-001');
      expect(result.id).toBe('inv-001');
    });

    it('throws NotFoundException for unknown invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.findOne(ORG_ID, 'ghost-id')).rejects.toThrow(NotFoundException);
    });
  });
});
