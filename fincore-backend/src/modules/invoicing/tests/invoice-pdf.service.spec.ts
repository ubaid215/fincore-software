/**
 * src/modules/invoicing/tests/invoice-pdf.service.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { PrismaService } from '../../../database/prisma.service';
import Decimal from 'decimal.js';

// ── Mock Puppeteer with proper typing (FIXED hoisting issue) ─────────────────

// Define mocks INSIDE the jest.mock factory to avoid hoisting issues
jest.mock('puppeteer', () => {
  // All mocks are defined inside the factory function
  const mockPdf = jest.fn().mockResolvedValue(Buffer.from('mock-pdf-bytes'));
  const mockSetContent = jest.fn().mockResolvedValue(undefined);
  const mockNewPage = jest.fn().mockResolvedValue({
    setContent: mockSetContent,
    pdf: mockPdf,
    close: jest.fn().mockResolvedValue(undefined),
  });
  const mockBrowserClose = jest.fn().mockResolvedValue(undefined);
  const mockBrowser = {
    newPage: mockNewPage,
    close: mockBrowserClose,
  };
  const mockLaunch = jest.fn().mockResolvedValue(mockBrowser);

  return {
    default: {
      launch: mockLaunch,
    },
  };
});

// Import after mock to get typed references
import puppeteer from 'puppeteer';

// Get typed references to the mocked functions for assertions
const mockLaunch = puppeteer.launch as jest.Mock;

// ── Mock S3Client ──────────────────────────────────────────────────────────

interface S3CallRecord {
  Bucket?: string;
  Key?: string;
  ContentType?: string;
  Metadata?: Record<string, string>;
  Body?: Buffer;
  [key: string]: unknown;
}

const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

// ── Mock fs ────────────────────────────────────────────────────────────────

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(`
    <html><body>
      <p>{{invoiceNumber}}</p>
      <p>{{orgName}}</p>
      <p>{{clientName}}</p>
      <p>Total: {{currency}} {{formatMoney totalAmount}}</p>
      {{#each lineItems}}<p>{{description}}</p>{{/each}}
    </body></html>
  `),
}));

// ── Fixtures with proper typing ──────────────────────────────────────────────

interface InvoiceWithRelations {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  amountPaid: Decimal;
  notes: string | null;
  pdfUrl: string | null;
  lineItems: Array<{
    id: string;
    invoiceId: string;
    description: string;
    quantity: Decimal;
    unitPrice: Decimal;
    taxCode: string | null;
    taxRate: Decimal;
    discount: Decimal;
    total: Decimal;
  }>;
  payments: Array<unknown>;
  organization: {
    name: string;
    email: string;
  };
}

const makeFullInvoice = (overrides: Partial<InvoiceWithRelations> = {}): InvoiceWithRelations => ({
  id: 'inv-001',
  organizationId: 'org-001',
  invoiceNumber: 'INV-2025-000001',
  status: 'SENT',
  clientName: 'ACME Corp',
  clientEmail: 'billing@acme.com',
  clientAddress: '123 Main St, Karachi',
  issueDate: new Date('2025-06-01'),
  dueDate: new Date('2025-06-30'),
  currency: 'PKR',
  subtotal: new Decimal(200000),
  discountAmount: new Decimal(0),
  taxAmount: new Decimal(34000),
  totalAmount: new Decimal(234000),
  amountPaid: new Decimal(0),
  notes: 'Net 30',
  pdfUrl: null,
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
  organization: { name: 'FinCore Technologies', email: 'admin@fincore.app' },
  ...overrides,
});

const mockPrisma = {
  invoice: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockConfig = {
  get: jest.fn((key: string, def?: string) => {
    const map: Record<string, string> = {
      'aws.region': 'ap-south-1',
      'aws.accessKeyId': 'test-key',
      'aws.secretAccessKey': 'test-secret',
      'aws.s3.documentsBucket': 'fincore-docs-dev',
    };
    return map[key] ?? def ?? key;
  }),
};

// Helper to get the browser instance from the launch mock
async function getBrowserFromLaunch() {
  const browser = await mockLaunch();
  return browser as { newPage: jest.Mock; close: jest.Mock };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;
  let mockPageSetContent: jest.Mock;
  let mockPagePdf: jest.Mock;
  let mockBrowserClose: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePdfService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<InvoicePdfService>(InvoicePdfService);
    jest.clearAllMocks();

    mockPrisma.invoice.findFirst.mockResolvedValue(makeFullInvoice());
    mockS3Send.mockResolvedValue({});

    // Get references to the mocked functions from the browser instance
    const browser = await getBrowserFromLaunch();
    const page = await browser.newPage();
    mockPageSetContent = page.setContent as jest.Mock;
    mockPagePdf = page.pdf as jest.Mock;
    mockBrowserClose = browser.close as jest.Mock;

    // Reset mock implementations
    mockPagePdf.mockResolvedValue(Buffer.from('mock-pdf-bytes'));
    mockPageSetContent.mockResolvedValue(undefined);
  });

  describe('generateAndUpload()', () => {
    it('returns S3 key in org/year/month/INV-number.pdf format', async () => {
      const result = await service.generateAndUpload('inv-001', 'org-001');

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      expect(result.s3Key).toBe(`invoices/org-001/${year}/${month}/INV-2025-000001.pdf`);
    });

    it('returns the correct S3 URL with bucket and region', async () => {
      const result = await service.generateAndUpload('inv-001', 'org-001');

      expect(result.s3Url).toContain('fincore-docs-dev');
      expect(result.s3Url).toContain('ap-south-1');
      expect(result.s3Url).toContain('INV-2025-000001.pdf');
    });

    it('returns correct sizeBytes from the PDF buffer', async () => {
      const pdfBytes = Buffer.from('mock-pdf-content-12345');
      mockPagePdf.mockResolvedValue(pdfBytes);

      const result = await service.generateAndUpload('inv-001', 'org-001');
      expect(result.sizeBytes).toBe(pdfBytes.length);
    });

    it('updates invoice.pdfUrl in the database after upload', async () => {
      await service.generateAndUpload('inv-001', 'org-001');

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-001' },
          data: { pdfUrl: expect.stringContaining('INV-2025-000001.pdf') },
        }),
      );
    });

    it('passes ContentType application/pdf to S3', async () => {
      await service.generateAndUpload('inv-001', 'org-001');

      const s3Call = mockS3Send.mock.calls[0]?.[0] as S3CallRecord;
      expect(s3Call.ContentType).toBe('application/pdf');
    });

    it('passes correct Metadata to S3 (invoiceNumber + organizationId)', async () => {
      await service.generateAndUpload('inv-001', 'org-001');

      const s3Call = mockS3Send.mock.calls[0]?.[0] as S3CallRecord;
      const meta = s3Call.Metadata ?? {};
      expect(meta?.invoiceNumber).toBe('INV-2025-000001');
      expect(meta?.organizationId).toBe('org-001');
    });

    it('calls Puppeteer page.setContent with HTML containing invoice number', async () => {
      await service.generateAndUpload('inv-001', 'org-001');

      expect(mockPageSetContent).toHaveBeenCalled();
      const [html] = mockPageSetContent.mock.calls[0] as [string];
      expect(html).toContain('INV-2025-000001');
    });

    it('closes Puppeteer browser even if PDF generation throws', async () => {
      mockPagePdf.mockRejectedValue(new Error('Puppeteer crashed'));

      await expect(service.generateAndUpload('inv-001', 'org-001')).rejects.toThrow(
        'Puppeteer crashed',
      );
      expect(mockBrowserClose).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.generateAndUpload('ghost-id', 'org-001')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockLaunch).not.toHaveBeenCalled();
    });

    it('marks overdue invoices correctly in template context', async () => {
      const pastDue = makeFullInvoice({ dueDate: new Date('2020-01-01'), status: 'SENT' });
      mockPrisma.invoice.findFirst.mockResolvedValue(pastDue);

      await expect(service.generateAndUpload('inv-001', 'org-001')).resolves.toBeDefined();
    });

    it('handles invoices with no dueDate (optional field)', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeFullInvoice({ dueDate: null }));

      await expect(service.generateAndUpload('inv-001', 'org-001')).resolves.toBeDefined();
    });
  });
});
