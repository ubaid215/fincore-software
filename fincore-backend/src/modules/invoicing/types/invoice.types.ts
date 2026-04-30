/**
 * src/modules/invoicing/types/invoice.types.ts
 *
 * FIXES:
 *  24. INVOICE_TRANSITIONS — OVERDUE corrected: no PARTIALLY_PAID,
 *      only PAID | VOID | DISPUTED
 *  25. InvoiceWithRelations — all new schema fields added:
 *      customerId, sentAt, paidAt, voidedAt, amountDue,
 *      purchaseOrder, exchangeRate, deletedAt, terms, clientTaxId
 */

import type { InvoiceStatus, RecurringPeriod, ContactType } from '@prisma/client';
import type Decimal from 'decimal.js';

// ─── Line item calculation ─────────────────────────────────────────────────

export interface RawLineItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxCode?: string;
  readonly taxRate?: number; // 0–1 decimal fraction e.g. 0.17 = 17%
  readonly discount?: number; // 0–1 decimal fraction e.g. 0.05 = 5%
  readonly productId?: string;
  readonly sortOrder?: number;
}

export interface ComputedLineItem {
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly taxCode: string | null;
  readonly taxRate: string;
  readonly discount: string;
  readonly total: string;
  readonly productId?: string;
  readonly sortOrder?: number;
}

// ─── Totals ────────────────────────────────────────────────────────────────

export interface InvoiceTotals {
  readonly subtotal: Decimal;
  readonly discountAmount: Decimal;
  readonly taxAmount: Decimal;
  readonly totalAmount: Decimal;
}

// ─── State machine ─────────────────────────────────────────────────────────

/**
 * FIX 24: OVERDUE → PARTIALLY_PAID removed (incorrect).
 * An OVERDUE invoice has already passed due date — it cannot regress
 * to PARTIALLY_PAID. It can only move to PAID (full payment received),
 * VOID (write-off), or DISPUTED (client contest).
 *
 * DRAFT          → SENT | VOID
 * SENT           → VIEWED | PARTIALLY_PAID | PAID | OVERDUE | VOID | DISPUTED
 * VIEWED         → PARTIALLY_PAID | PAID | OVERDUE | VOID | DISPUTED
 * PARTIALLY_PAID → PAID | OVERDUE | VOID | DISPUTED
 * OVERDUE        → PAID | VOID | DISPUTED           ← FIX 24
 * PAID           → (terminal)
 * VOID           → (terminal)
 * DISPUTED       → SENT | VOID
 */
export const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStatus, InvoiceStatus[]>> = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'DISPUTED'],
  VIEWED: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'DISPUTED'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE', 'VOID', 'DISPUTED'],
  OVERDUE: ['PAID', 'VOID', 'DISPUTED'], // FIX 24: removed PARTIALLY_PAID
  PAID: [],
  VOID: [],
  DISPUTED: ['SENT', 'VOID'],
} as const;

// ─── Payment ───────────────────────────────────────────────────────────────

export interface RecordedPayment {
  readonly invoiceId: string;
  readonly amount: Decimal;
  readonly currency: string;
  readonly exchangeRate: Decimal;
  readonly method: string;
  readonly reference?: string;
  readonly notes?: string;
  readonly paidAt: Date;
}

export type PaymentStatusResult = 'PARTIALLY_PAID' | 'PAID';

// ─── FX ────────────────────────────────────────────────────────────────────

export interface FxRate {
  readonly currency: string;
  readonly rate: number;
  readonly fetchedAt: Date;
}

export interface FxRateMap {
  readonly base: string;
  readonly rates: Readonly<Record<string, number>>;
  readonly timestamp: number;
}

// ─── PDF ───────────────────────────────────────────────────────────────────

export interface PdfJobPayload {
  readonly invoiceId: string;
  readonly organizationId: string;
}

export interface PdfGenerationResult {
  readonly s3Key: string;
  readonly s3Url: string;
  readonly sizeBytes: number;
}

// ─── Customer snapshot (embedded in Invoice) ───────────────────────────────

export interface CustomerSnapshot {
  id: string | null; // Contact.id — null if created without Contact link
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null; // NTN / GST / VAT
  contactType: ContactType | null;
}

// ─── Invoice with relations (FIX 25 — all new schema fields) ──────────────

export interface InvoiceWithRelations {
  // ── Identity ───────────────────────────────────────────────────────────
  id: string;
  organizationId: string;
  invoiceNumber: string;

  // ── Customer (FIX 25: new fields) ─────────────────────────────────────
  customerId: string | null; // → Contact.id
  clientName: string; // snapshot at time of issue
  clientEmail: string | null;
  clientAddress: string | null;
  clientTaxId: string | null; // NTN / GST snapshot

  // ── Dates & status (FIX 25: new fields) ───────────────────────────────
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  sentAt: Date | null; // FIX 25
  paidAt: Date | null; // FIX 25
  voidedAt: Date | null; // FIX 25

  // ── Amounts (FIX 25: exchangeRate, amountDue) ──────────────────────────
  currency: string;
  exchangeRate: object; // Prisma Decimal
  subtotal: object;
  taxAmount: object;
  discountAmount: object;
  totalAmount: object;
  amountPaid: object;
  amountDue: object; // FIX 25

  // ── Metadata ────────────────────────────────────────────────────────────
  purchaseOrder: string | null; // FIX 25: client's PO reference
  terms: string | null; // FIX 25: payment terms text
  reference: string | null;
  notes: string | null;
  pdfUrl: string | null;
  pdfS3Key: string | null; // FIX 28

  // ── Recurring ──────────────────────────────────────────────────────────
  isRecurring: boolean;
  recurringPeriod: RecurringPeriod | null;
  recurringEndDate: Date | null;

  // ── Soft-delete (FIX 25) ───────────────────────────────────────────────
  deletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  // ── Relations ──────────────────────────────────────────────────────────
  lineItems: InvoiceLineItemRecord[];
  payments: InvoicePaymentRecord[];
  customer?: CustomerSnapshot | null; // populated when customerId is set
}

export interface InvoiceLineItemRecord {
  id: string;
  invoiceId: string;
  productId: string | null;
  description: string;
  quantity: object;
  unitPrice: object;
  taxCode: string | null;
  taxRate: object;
  discount: object;
  total: object;
  sortOrder: number;
}

export interface InvoicePaymentRecord {
  id: string;
  invoiceId: string;
  amount: object;
  currency: string;
  exchangeRate: object; // FIX 9
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdAt: Date;
}

// ─── Overdue summary (cron result) ────────────────────────────────────────

export interface OverdueSummary {
  checkedAt: Date;
  marked: number;
  invoiceIds: string[];
}
