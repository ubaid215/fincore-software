/**
 * src/modules/invoicing/services/invoice-pdf.service.ts
 *
 * FIXES:
 *  26. buildContext() — customer Contact fields included (taxId, phone, full address)
 *  27. Organization fields enriched — logoUrl, phone, website, address
 *  28. Both pdfUrl AND pdfS3Key updated on invoice after upload
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { toDecimal } from '../../../common/utils/decimal.util';
import type { PdfGenerationResult } from '../types/invoice.types';

// ─── Template context ──────────────────────────────────────────────────────

interface OrgContext {
  name: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  address: string;
}

interface CustomerContext {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
}

interface LineItemCtx {
  index: number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxCode: string;
  taxRate: string;
  discount: string;
  total: string;
}

interface TemplateContext {
  org: OrgContext;
  customer: CustomerContext;
  invoiceNumber: string;
  purchaseOrder: string;
  reference: string;
  status: string;
  issueDate: string;
  dueDate: string;
  isOverdue: boolean;
  currency: string;
  lineItems: LineItemCtx[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  hasDiscount: boolean;
  hasTax: boolean;
  hasPaid: boolean;
  terms: string;
  notes: string;
  generatedAt: string;
}

// ─── Handlebars helpers ─────────────────────────────────────────────────────

function registerHelpers(): void {
  if (Handlebars.helpers['formatMoney']) return; // idempotent

  Handlebars.registerHelper('formatMoney', (value: unknown): string => {
    const d = toDecimal(String(value));
    return d.toDecimalPlaces(2).toNumber().toLocaleString('en-PK', { minimumFractionDigits: 2 });
  });

  Handlebars.registerHelper('formatPercent', (value: unknown): string => {
    const d = toDecimal(String(value));
    if (d.isZero()) return '—';
    return `${d.mul(100).toDecimalPlaces(2)}%`;
  });

  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('increment', (i: number) => i + 1);
  Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
}

registerHelpers();

// ─── Invoice shape expected by this service ─────────────────────────────────

export interface InvoiceForPdf {
  invoiceNumber: string;
  purchaseOrder: string | null;
  reference: string | null;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  clientTaxId: string | null;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  terms: string | null;
  notes: string | null;
  lineItems: Array<{
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    taxCode: string | null;
    taxRate: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
    sortOrder: number;
  }>;
  // FIX 27: enriched org + FIX 26: enriched customer
  organization: {
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    logoUrl: string | null;
    // Address fields
    country: string | null;
  };
  customer?: {
    displayName: string;
    email: string | null;
    phone: string | null;
    taxId: string | null;
    addressLine1: string | null;
    city: string | null;
    country: string | null;
  } | null;
}

// ─── Service ────────────────────────────────────────────────────────────────

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
    // FIX 26 & 27: Include customer Contact + full org fields
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: true,
        customer: {
          select: {
            displayName: true,
            email: true,
            phone: true,
            taxId: true,
            addressLine1: true,
            city: true,
            country: true,
          },
        },
        organization: {
          select: {
            name: true,
            email: true,
            phone: true,
            website: true,
            logoUrl: true,
            country: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const ctx = this.buildContext(invoice as any);
    const html = this.renderHtml(ctx);
    const pdfBuffer = await this.renderPdf(html, invoice.invoiceNumber);
    const result = await this.uploadToS3(pdfBuffer, invoice.invoiceNumber, organizationId);

    // FIX 28: Update BOTH pdfUrl and pdfS3Key
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: result.s3Url, pdfS3Key: result.s3Key },
    });

    this.logger.log(
      `PDF for ${invoice.invoiceNumber} → ${result.s3Key} (${result.sizeBytes} bytes)`,
    );
    return result;
  }

  // ─── Context builder ──────────────────────────────────────────────────────

  private buildContext(invoice: InvoiceForPdf): TemplateContext {
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

    const now = new Date();
    const isOverdue =
      invoice.dueDate !== null &&
      invoice.dueDate < now &&
      !['PAID', 'VOID'].includes(invoice.status);

    const total = toDecimal(invoice.totalAmount.toString());
    const paid = toDecimal(invoice.amountPaid.toString());
    const balance = Decimal.max(total.minus(paid), new Decimal(0));

    // FIX 26: Customer — prefer Contact fields, fall back to snapshot
    const cust = invoice.customer;
    const customerCtx: CustomerContext = {
      name: cust?.displayName ?? invoice.clientName,
      email: cust?.email ?? invoice.clientEmail ?? '',
      phone: cust?.phone ?? '',
      address: cust
        ? [cust.addressLine1, cust.city, cust.country].filter(Boolean).join(', ')
        : (invoice.clientAddress ?? ''),
      taxId: cust?.taxId ?? invoice.clientTaxId ?? '',
    };

    // FIX 27: Organization — all fields
    const org = invoice.organization;
    const orgCtx: OrgContext = {
      name: org.name,
      email: org.email ?? '',
      phone: org.phone ?? '',
      website: org.website ?? '',
      logoUrl: org.logoUrl ?? '',
      address: org.country ?? '',
    };

    return {
      org: orgCtx,
      customer: customerCtx,
      invoiceNumber: invoice.invoiceNumber,
      purchaseOrder: invoice.purchaseOrder ?? '',
      reference: invoice.reference ?? '',
      status: invoice.status,
      issueDate: fmt(invoice.issueDate),
      dueDate: invoice.dueDate ? fmt(invoice.dueDate) : '',
      isOverdue,
      currency: invoice.currency,
      lineItems: invoice.lineItems
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((li, i) => ({
          index: i + 1,
          description: li.description,
          quantity: li.quantity.toString(),
          unitPrice: li.unitPrice.toString(),
          taxCode: li.taxCode ?? '',
          taxRate: li.taxRate.toString(),
          discount: li.discount.toString(),
          total: li.total.toString(),
        })),
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: total.toString(),
      amountPaid: paid.toString(),
      balanceDue: balance.toString(),
      hasDiscount: toDecimal(invoice.discountAmount.toString()).gt(0),
      hasTax: toDecimal(invoice.taxAmount.toString()).gt(0),
      hasPaid: paid.gt(0),
      terms: invoice.terms ?? '',
      notes: invoice.notes ?? '',
      generatedAt: now.toLocaleString('en-PK'),
    };
  }

  private renderHtml(ctx: TemplateContext): string {
    if (!this.compiledTemplate) {
      const tplPath = path.join(__dirname, '..', 'pdf', 'invoice.template.hbs');
      const source = fs.readFileSync(tplPath, 'utf-8');
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
      if (browser) await browser.close();
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
      Metadata: { invoiceNumber, organizationId, generatedAt: now.toISOString() },
    };

    await this.s3.send(new PutObjectCommand(command));

    const region = this.config.get('aws.region', 'ap-south-1');
    const s3Url = `https://${this.bucket}.s3.${region}.amazonaws.com/${s3Key}`;

    return { s3Key, s3Url, sizeBytes: buffer.length };
  }
}
