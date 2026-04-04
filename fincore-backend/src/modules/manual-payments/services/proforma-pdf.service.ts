// src/modules/manual-payments/services/proforma-pdf.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ProformaData } from '../types/manual-payment.types';

@Injectable()
export class ProformaPdfService implements OnModuleInit {
  private readonly logger = new Logger(ProformaPdfService.name);
  private template: HandlebarsTemplateDelegate | null = null;
  private s3Client: S3Client;
  private readonly bucket: string;
  private helpersRegistered = false;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('s3.documentsBucket', 'fincore-documents-dev');
    this.s3Client = new S3Client({
      region: this.configService.get<string>('aws.region', 'ap-south-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId', 'dummy'),
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey', 'dummy'),
      },
    });
  }

  async onModuleInit() {
    await this.loadTemplate();
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers(): void {
    if (this.helpersRegistered) return;

    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-PK', { style: 'currency', currency }).format(amount);
    });

    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);

    this.helpersRegistered = true;
    this.logger.debug('Handlebars helpers registered');
  }

  private async loadTemplate(): Promise<void> {
    // Try multiple possible paths for the template
    const possiblePaths = [
      // Production path (from dist)
      path.join(__dirname, '..', 'templates', 'proforma.hbs'),
      // Development path (from src)
      path.join(process.cwd(), 'src', 'modules', 'manual-payments', 'templates', 'proforma.hbs'),
      // Alternative dist path
      path.join(
        process.cwd(),
        'dist',
        'src',
        'modules',
        'manual-payments',
        'templates',
        'proforma.hbs',
      ),
      // Fallback path
      path.join(__dirname, 'templates', 'proforma.hbs'),
    ];

    let templatePath: string | null = null;

    for (const tryPath of possiblePaths) {
      try {
        await fs.access(tryPath);
        templatePath = tryPath;
        this.logger.debug(`Found template at: ${templatePath}`);
        break;
      } catch {
        // Continue to next path
        continue;
      }
    }

    if (!templatePath) {
      this.logger.error(`Pro-forma template not found. Tried paths:\n${possiblePaths.join('\n')}`);
      throw new Error(
        'Pro-forma template not found. Please ensure proforma.hbs exists in the templates directory.',
      );
    }

    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      this.template = Handlebars.compile(content);
      this.logger.log(`Pro-forma template loaded successfully from: ${templatePath}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to read pro-forma template: ${error.message}`);
      throw new Error(`Failed to load pro-forma template: ${error.message}`);
    }
  }

  /**
   * Generate PDF from pro-forma data and upload to S3
   * Returns S3 key and presigned URL
   */
  async generateAndUpload(data: ProformaData): Promise<{ s3Key: string; url: string }> {
    if (!this.template) {
      await this.loadTemplate();
    }

    // Validate required data fields
    this.validateProformaData(data);

    // Generate HTML from template
    let html: string;
    try {
      html = this.template!(data);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to generate HTML from template: ${error.message}`);
      throw new Error(`Template rendering failed: ${error.message}`);
    }

    // Launch puppeteer and generate PDF
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        }),
      );
      this.logger.debug(`PDF generated for reference code: ${data.referenceCode}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to generate PDF: ${error.message}`);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      await browser.close();
    }

    // Upload to S3
    const s3Key = `proforma/${data.referenceCode}/${Date.now()}.pdf`;
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          Metadata: {
            referenceCode: data.referenceCode,
            customerEmail: data.customerEmail,
            planName: data.planDisplayName || data.planName || 'Unknown',
          },
        }),
      );
      this.logger.debug(`Pro-forma PDF uploaded to S3: ${s3Key}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to upload PDF to S3: ${error.message}`);
      throw new Error(`S3 upload failed: ${error.message}`);
    }

    // Generate presigned URL (valid for 7 days)
    let url: string;
    try {
      url = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
        { expiresIn: 7 * 24 * 60 * 60 },
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }

    return { s3Key, url };
  }

  /**
   * Get presigned URL for existing pro-forma PDF
   */
  async getPresignedUrl(s3Key: string): Promise<string> {
    try {
      const url = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
        { expiresIn: 7 * 24 * 60 * 60 },
      );
      return url;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to generate presigned URL for ${s3Key}: ${error.message}`);
      throw new Error(`Failed to get presigned URL: ${error.message}`);
    }
  }

  /**
   * Validate required fields in pro-forma data
   */
  private validateProformaData(data: ProformaData): void {
    const requiredFields: (keyof ProformaData)[] = [
      'referenceCode',
      'invoiceNumber',
      'issueDate',
      'customerName',
      'customerEmail',
      'planDisplayName',
      'expiresAt',
      'bankName',
      'bankAccountTitle',
      'bankIban',
      'bankSwift',
      'amount',
      'currency',
    ];

    const missingFields = requiredFields.filter((field) => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      this.logger.error(`Missing required fields: ${missingFields.join(', ')}`);
      throw new Error(`Missing required pro-forma data fields: ${missingFields.join(', ')}`);
    }
  }
}
