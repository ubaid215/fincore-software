/**
 * Unit tests for ProformaPdfService — PDF generation (Uint8Array → Buffer) and S3 upload.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProformaPdfService } from '../services/proforma-pdf.service';
import { ProformaData } from '../types/manual-payment.types';

jest.mock('puppeteer', () => {
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
  const mockLaunch = jest.fn().mockResolvedValue(mockBrowser);
  return {
    __esModule: true,
    default: { launch: mockLaunch },
    launch: mockLaunch,
  };
});

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(
    '<html><body>{{referenceCode}} {{customerName}} {{formatCurrency amount currency}}</body></html>',
  ),
}));

const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/proforma.pdf'),
}));

describe('ProformaPdfService', () => {
  let service: ProformaPdfService;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProformaPdfService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get(ProformaPdfService);
    await service.onModuleInit();
  });

  describe('generateAndUpload', () => {
    it('converts Puppeteer PDF bytes to Buffer before S3 upload', async () => {
      const { s3Key, url } = await service.generateAndUpload(sampleProforma);

      expect(mockS3Send).toHaveBeenCalled();
      const put = mockS3Send.mock.calls[0][0] as { Body?: Buffer; input?: { Body?: Buffer } };
      const body = put.Body ?? put.input?.Body;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(s3Key).toContain('proforma/');
      expect(url).toContain('https://');
    });

    it('throws when template cannot be loaded on first generate', async () => {
      const fs = await import('fs/promises');
      (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [ProformaPdfService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const fresh = module.get(ProformaPdfService);

      await expect(fresh.generateAndUpload(sampleProforma)).rejects.toThrow();
    });
  });

  describe('getPresignedUrl', () => {
    it('returns a presigned URL string', async () => {
      const url = await service.getPresignedUrl('proforma/key/file.pdf');
      expect(url).toBe('https://signed.example.com/proforma.pdf');
    });
  });
});
