/**
 * src/modules/invoicing/services/invoice-pdf.service.ts
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client'; // ← add
import { PrismaService } from '../../../database/prisma.service';
import { toDecimal } from '../../../common/utils/decimal.util';
import type { PdfGenerationResult } from '../types/invoice.types';

// ─── Handlebars template context ──────────────────────────────────────────

interface TemplateContext {
  orgName: string;
  orgEmail: string;
  invoiceNumber: string;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  issueDate: string;
  dueDate: string | null;
  isOverdue: boolean;
  currency: string;
  lineItems: TemplateLineItem[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  hasDiscount: boolean;
  hasTax: boolean;
  hasPaid: boolean;
  notes: string | null;
  generatedAt: string;
}

interface TemplateLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  taxCode: string | null;
  taxRate: string;
  discount: string;
  total: string;
}

// DecimalLike removed — Prisma.Decimal used directly below

// ─── Register Handlebars helpers ───────────────────────────────────────────

function registerHelpers(): void {
  Handlebars.registerHelper('formatMoney', (value: unknown): string => {
    const d = toDecimal(value as string);
    return d.toDecimalPlaces(2).toNumber().toLocaleString('en-PK', { minimumFractionDigits: 2 });
  });

  Handlebars.registerHelper('formatPercent', (value: unknown): string => {
    const d = toDecimal(value as string);
    if (d.isZero()) return '—';
    return `${d.mul(100).toDecimalPlaces(2).toString()}%`;
  });

  Handlebars.registerHelper('formatNumber', (value: unknown): string => {
    const d = toDecimal(value as string);
    return d.toDecimalPlaces(2).toString();
  });

  Handlebars.registerHelper('increment', (index: number): number => index + 1);
}

registerHelpers();

// ─── Shared parameter type for buildContext ────────────────────────────────
// Defined once here so the integration spec (and any other caller) can import
// it instead of duplicating the shape.

export interface InvoiceForPdf {
  invoiceNumber: string;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  notes: string | null;
  lineItems: Array<{
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    taxCode: string | null;
    taxRate: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
  }>;
  organization: { name: string; email: string | null };
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private compiledTemplate: HandlebarsTemplateDelegate<TemplateContext> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: config.get<string>('aws.region', 'ap-south-1'),
      credentials: {
        accessKeyId: config.get<string>('aws.accessKeyId', 'dummy'),
        secretAccessKey: config.get<string>('aws.secretAccessKey', 'dummy'),
      },
    });

    this.bucket = config.get<string>('aws.s3.documentsBucket', 'fincore-documents-dev');
  }

  async generateAndUpload(invoiceId: string, organizationId: string): Promise<PdfGenerationResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: { lineItems: true, payments: true, organization: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const ctx = this.buildContext(invoice);
    const html = this.renderHtml(ctx);
    const pdfBuffer = await this.renderPdf(html, invoice.invoiceNumber);
    const result = await this.uploadToS3(pdfBuffer, invoice.invoiceNumber, organizationId);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: result.s3Url },
    });

    this.logger.log(
      `PDF for ${invoice.invoiceNumber} uploaded → ${result.s3Key} (${result.sizeBytes} bytes)`,
    );

    return result;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private buildContext(invoice: InvoiceForPdf): TemplateContext {
    const fmt = (d: Date): string =>
      d.toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

    const now = new Date();
    const isOverdue =
      invoice.dueDate !== null &&
      invoice.dueDate < now &&
      !['PAID', 'VOID'].includes(invoice.status);

    const totalAmount = toDecimal(invoice.totalAmount.toString());
    const amountPaid = toDecimal(invoice.amountPaid.toString());
    const balanceDue = Decimal.max(totalAmount.minus(amountPaid), new Decimal(0));

    return {
      orgName: invoice.organization.name,
      orgEmail: invoice.organization.email ?? '',
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientAddress: invoice.clientAddress,
      issueDate: fmt(invoice.issueDate),
      dueDate: invoice.dueDate ? fmt(invoice.dueDate) : null,
      isOverdue,
      currency: invoice.currency,
      lineItems: invoice.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity.toString(),
        unitPrice: li.unitPrice.toString(),
        taxCode: li.taxCode,
        taxRate: li.taxRate.toString(),
        discount: li.discount.toString(),
        total: li.total.toString(),
      })),
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      amountPaid: amountPaid.toString(),
      balanceDue: balanceDue.toString(),
      hasDiscount: toDecimal(invoice.discountAmount.toString()).gt(0),
      hasTax: toDecimal(invoice.taxAmount.toString()).gt(0),
      hasPaid: amountPaid.gt(0),
      notes: invoice.notes,
      generatedAt: now.toLocaleString('en-PK'),
    };
  }

  private renderHtml(ctx: TemplateContext): string {
    if (!this.compiledTemplate) {
      const templatePath = path.join(__dirname, '..', 'pdf', 'invoice.template.hbs');
      const source = fs.readFileSync(templatePath, 'utf-8');
      this.compiledTemplate = Handlebars.compile<TemplateContext>(source);
    }
    return this.compiledTemplate(ctx);
  }

  private async renderPdf(html: string, invoiceNumber: string): Promise<Buffer> {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      this.logger.debug(`PDF rendered for ${invoiceNumber} (${pdf.length} bytes)`);
      return Buffer.from(pdf);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async uploadToS3(
    buffer: Buffer,
    invoiceNumber: string,
    organizationId: string,
  ): Promise<PdfGenerationResult> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const s3Key = `invoices/${organizationId}/${year}/${month}/${invoiceNumber}.pdf`;

    const command: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: `inline; filename="${invoiceNumber}.pdf"`,
      Metadata: {
        invoiceNumber,
        organizationId,
        generatedAt: now.toISOString(),
      },
    };

    await this.s3.send(new PutObjectCommand(command));

    const s3Url = `https://${this.bucket}.s3.${this.config.get('aws.region', 'ap-south-1')}.amazonaws.com/${s3Key}`;

    return { s3Key, s3Url, sizeBytes: buffer.length };
  }
}
