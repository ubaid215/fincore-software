/**
 * Unit tests for ProformaPdfService — PDF generation (Uint8Array → Buffer) and S3 upload.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProformaPdfService } from '../services/proforma-pdf.service';
import { ProformaData } from '../types/manual-payment.types';

// ── fs/promises mock ──────────────────────────────────────────────────────────
const mockReadFile = jest
  .fn()
  .mockResolvedValue(
    '<html><body>{{referenceCode}} {{customerName}} {{formatCurrency amount currency}}</body></html>',
  );
const mockAccess = jest.fn().mockResolvedValue(undefined);

jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]): unknown => mockReadFile(...args),
  access: (...args: unknown[]): unknown => mockAccess(...args),
}));

// ── Puppeteer mock ────────────────────────────────────────────────────────────
// The service imports puppeteer as:  import * as puppeteer from 'puppeteer'
// and calls:                         puppeteer.launch(...)
//
// jest.mock() is hoisted before variable declarations so we CANNOT reference
// a const inside the factory. We put jest.fn() inline and retrieve the
// reference afterward. We mock BOTH the named export and the default export
// because different versions of puppeteer expose one or the other.
jest.mock('puppeteer', () => {
  const launchFn = jest.fn();
  return {
    __esModule: true,
    launch: launchFn, // namespace import:  puppeteer.launch()
    default: { launch: launchFn }, // default import:  puppeteer.default.launch()
  };
});

// ── S3 mock ───────────────────────────────────────────────────────────────────
const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/proforma.pdf'),
}));

// ── Retrieve typed mock references AFTER jest.mock() calls ───────────────────
import * as puppeteer from 'puppeteer';
// The service calls puppeteer.launch — grab that reference
const mockLaunch = puppeteer.launch as jest.Mock;

// ── Browser / page stubs ──────────────────────────────────────────────────────
const mockPdf = jest.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
const mockSetContent = jest.fn().mockResolvedValue(undefined);
const mockNewPage = jest.fn().mockResolvedValue({
  setContent: mockSetContent,
  pdf: mockPdf,
});
const mockBrowserClose = jest.fn().mockResolvedValue(undefined);
const mockBrowser = {
  newPage: mockNewPage,
  close: mockBrowserClose,
};

// ── Shared fixtures ───────────────────────────────────────────────────────────
const mockConfigService = {
  get: jest.fn((key: string, def?: string) => {
    const map: Record<string, string> = {
      's3.documentsBucket': 'test-bucket',
      'aws.region': 'ap-south-1',
      'aws.accessKeyId': 'ak',
      'aws.secretAccessKey': 'sk',
    };
    return map[key] ?? def ?? '';
  }),
};

// All fields that validateProformaData() treats as required
const sampleProforma: ProformaData = {
  referenceCode: 'AB12CD34',
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  planName: 'PRO',
  planDisplayName: 'Professional',
  amount: 1000,
  currency: 'PKR',
  bankName: 'HBL',
  bankAccountTitle: 'FinCore',
  bankIban: 'PK00HABB0000000000000000',
  bankSwift: 'HABBPKKA',
  expiresAt: new Date('2026-12-31'),
  invoiceNumber: 'PF-AB12CD34',
  issueDate: new Date('2026-04-01'),
};

// ── Suite ─────────────────────────────────────────────────────────────────────
describe('ProformaPdfService', () => {
  let service: ProformaPdfService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Re-apply implementations wiped by clearAllMocks()
    mockLaunch.mockResolvedValue(mockBrowser);
    mockNewPage.mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf });
    mockPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mockSetContent.mockResolvedValue(undefined);
    mockBrowserClose.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(
      '<html><body>{{referenceCode}} {{customerName}} {{formatCurrency amount currency}}</body></html>',
    );
    mockAccess.mockResolvedValue(undefined);
    mockS3Send.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProformaPdfService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<ProformaPdfService>(ProformaPdfService);

    // Bypass real template loading — supply a pre-compiled stub and mark
    // helpers as already registered so onModuleInit side-effects are skipped.
    Object.assign(service, {
      template: (data: ProformaData) => data.referenceCode,
      helpersRegistered: true,
    });
  });

  // ── generateAndUpload ───────────────────────────────────────────────────────
  describe('generateAndUpload', () => {
    it('launches puppeteer, converts PDF bytes to Buffer, and uploads to S3', async () => {
      const { s3Key, url } = await service.generateAndUpload(sampleProforma);

      expect(mockLaunch).toHaveBeenCalled();
      expect(mockNewPage).toHaveBeenCalled();
      expect(mockS3Send).toHaveBeenCalled();

      // Explicitly type the captured call args to satisfy no-unsafe-member-access
      const [firstCallArgs] = mockS3Send.mock.calls as Array<[{ Body?: unknown }]>;
      expect(Buffer.isBuffer(firstCallArgs[0]?.Body)).toBe(true);

      expect(s3Key).toContain('proforma/');
      expect(url).toBe('https://signed.example.com/proforma.pdf');
    });

    it('throws "Pro-forma template not found" when all template paths are inaccessible', async () => {
      // Fresh service — no pre-loaded template so generateAndUpload calls loadTemplate()
      const module: TestingModule = await Test.createTestingModule({
        providers: [ProformaPdfService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const freshService = module.get<ProformaPdfService>(ProformaPdfService);
      Object.assign(freshService, { template: null });

      // All fs.access() calls fail → loadTemplate() exhausts all candidate paths
      // and throws: 'Pro-forma template not found. Please ensure proforma.hbs …'
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await expect(freshService.generateAndUpload(sampleProforma)).rejects.toThrow(
        'Pro-forma template not found',
      );
    });

    it('succeeds when all required fields are provided (minimal payload)', async () => {
      // planDisplayName is in validateProformaData's required list — must be present
      const minimalData: ProformaData = {
        referenceCode: 'TEST123',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        planDisplayName: 'Starter',
        amount: 500,
        currency: 'USD',
        bankName: 'Test Bank',
        bankAccountTitle: 'Test Account',
        bankIban: 'TEST123456',
        bankSwift: 'TESTUS33',
        expiresAt: new Date(),
        invoiceNumber: 'INV-001',
        issueDate: new Date(),
      };

      const { s3Key, url } = await service.generateAndUpload(minimalData);
      expect(s3Key).toBeDefined();
      expect(url).toBeDefined();
    });

    it('throws "Missing required pro-forma data fields" when customerName is absent', async () => {
      const invalidData = { ...sampleProforma } as Partial<ProformaData>;
      delete invalidData.customerName;

      await expect(service.generateAndUpload(invalidData as ProformaData)).rejects.toThrow(
        'Missing required pro-forma data fields',
      );
    });

    it('throws "Missing required pro-forma data fields" when planDisplayName is absent', async () => {
      const invalidData = { ...sampleProforma } as Partial<ProformaData>;
      delete invalidData.planDisplayName;

      await expect(service.generateAndUpload(invalidData as ProformaData)).rejects.toThrow(
        'Missing required pro-forma data fields',
      );
    });
  });

  // ── getPresignedUrl ─────────────────────────────────────────────────────────
  describe('getPresignedUrl', () => {
    it('returns a presigned URL string', async () => {
      const url = await service.getPresignedUrl('proforma/key/file.pdf');
      expect(url).toBe('https://signed.example.com/proforma.pdf');
    });

    it('wraps S3 errors as "Failed to get presigned URL"', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      (getSignedUrl as jest.Mock).mockRejectedValueOnce(new Error('S3 Error'));

      await expect(service.getPresignedUrl('proforma/key/file.pdf')).rejects.toThrow(
        'Failed to get presigned URL',
      );
    });
  });
});
