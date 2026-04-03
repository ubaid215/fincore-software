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
  }

  private async loadTemplate(): Promise<void> {
    const templatePath = path.join(__dirname, '..', 'templates', 'proforma.hbs');
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      this.template = Handlebars.compile(content);

      // Register Handlebars helpers
      Handlebars.registerHelper('formatCurrency', (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-PK', { style: 'currency', currency }).format(amount);
      });

      Handlebars.registerHelper('formatDate', (date: Date) => {
        return new Date(date).toLocaleDateString('en-PK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      });

      this.logger.debug('Pro-forma template loaded');
    } catch (error) {
      this.logger.error(`Failed to load pro-forma template: ${error}`);
      throw new Error('Pro-forma template not found');
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

    // Generate HTML from template
    const html = this.template!(data);

    // Launch puppeteer and generate PDF
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
    } finally {
      await browser.close();
    }

    // Upload to S3
    const s3Key = `proforma/${data.referenceCode}/${Date.now()}.pdf`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          referenceCode: data.referenceCode,
          customerEmail: data.customerEmail,
          planName: data.planName,
        },
      }),
    );

    this.logger.debug(`Pro-forma PDF uploaded: ${s3Key}`);

    // Generate presigned URL (valid for 7 days)
    const url = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn: 7 * 24 * 60 * 60 },
    );

    return { s3Key, url };
  }

  /**
   * Get presigned URL for existing pro-forma PDF
   */
  async getPresignedUrl(s3Key: string): Promise<string> {
    return getSignedUrl(this.s3Client, new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }), {
      expiresIn: 7 * 24 * 60 * 60,
    });
  }
}
