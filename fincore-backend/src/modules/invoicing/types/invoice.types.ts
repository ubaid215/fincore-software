/**
 * src/modules/invoicing/types/invoice.types.ts
 *
 * Shared TypeScript types for the Invoicing domain.
 * All monetary values use Decimal.js strings at the service layer
 * and are stored as DECIMAL(19,4) in PostgreSQL.
 *
 * Sprint: S2 · Week 5–6
 *
 * FIX: INVOICE_TRANSITIONS was missing VIEWED and OVERDUE entries,
 *      causing a TS2739 error because the record must cover every
 *      member of the InvoiceStatus enum (Readonly<Record<InvoiceStatus, …>>).
 *      Added both entries with appropriate allowed transitions.
 */

import type { InvoiceStatus } from '@prisma/client';
import type Decimal from 'decimal.js';

// ─── Line item calculation ─────────────────────────────────────────────────

/** Raw input from the DTO before any computation */
export interface RawLineItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxCode?: string;
  readonly taxRate?: number; // 0–1 (e.g. 0.17 = 17%)
  readonly discount?: number; // 0–1 (e.g. 0.10 = 10%)
}

/** Computed line item ready for DB write */
export interface ComputedLineItem {
  readonly description: string;
  readonly quantity: string; // Decimal string
  readonly unitPrice: string; // Decimal string
  readonly taxCode: string | null;
  readonly taxRate: string; // Decimal string
  readonly discount: string; // Decimal string
  readonly total: string; // Decimal string (qty × price × (1-disc) × (1+tax))
}

// ─── Totals ────────────────────────────────────────────────────────────────

/** Aggregated invoice totals after computing all lines */
export interface InvoiceTotals {
  readonly subtotal: Decimal; // sum of (qty × unitPrice) before tax/discount
  readonly discountAmount: Decimal; // total discount applied
  readonly taxAmount: Decimal; // total tax applied
  readonly totalAmount: Decimal; // final amount the client owes
}

// ─── State machine ─────────────────────────────────────────────────────────

/**
 * Allowed status transitions for the Invoice state machine.
 * The record maps FROM → allowed TO states.
 *
 * DRAFT          → SENT | VOID
 * SENT           → VIEWED | PARTIALLY_PAID | PAID | VOID | DISPUTED
 * VIEWED         → PARTIALLY_PAID | PAID | VOID | DISPUTED
 * PARTIALLY_PAID → PAID | VOID | DISPUTED
 * OVERDUE        → PAID | VOID | DISPUTED
 * PAID           → (terminal — no transitions allowed)
 * VOID           → (terminal — no transitions allowed)
 * DISPUTED       → SENT | VOID
 */
export const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStatus, InvoiceStatus[]>> = {
  DRAFT: ['SENT', 'VOID'],
  SENT: ['VIEWED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'DISPUTED'],
  VIEWED: ['PARTIALLY_PAID', 'PAID', 'VOID', 'DISPUTED'],
  PARTIALLY_PAID: ['PAID', 'VOID', 'DISPUTED'],
  OVERDUE: ['PAID', 'VOID', 'DISPUTED'],
  PAID: [],
  VOID: [],
  DISPUTED: ['SENT', 'VOID'],
} as const;

// ─── Payment recording ─────────────────────────────────────────────────────

export interface RecordedPayment {
  readonly invoiceId: string;
  readonly amount: Decimal;
  readonly currency: string;
  readonly method: string;
  readonly reference?: string;
  readonly paidAt: Date;
}

/** What the invoice status becomes after a payment is recorded */
export type PaymentStatusResult = 'PARTIALLY_PAID' | 'PAID';

// ─── FX Rate ───────────────────────────────────────────────────────────────

export interface FxRate {
  readonly currency: string; // e.g. 'USD'
  readonly rate: number; // 1 USD = rate PKR
  readonly fetchedAt: Date;
}

export interface FxRateMap {
  readonly base: string; // always 'PKR'
  readonly rates: Readonly<Record<string, number>>;
  readonly timestamp: number;
}

// ─── PDF generation ────────────────────────────────────────────────────────

export interface PdfJobPayload {
  readonly invoiceId: string;
  readonly organizationId: string;
}

export interface PdfGenerationResult {
  readonly s3Key: string;
  readonly s3Url: string;
  readonly sizeBytes: number;
}

// ─── Invoice with relations (service return type) ──────────────────────────

export interface InvoiceWithRelations {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  subtotal: object; // Prisma Decimal
  taxAmount: object;
  discountAmount: object;
  totalAmount: object;
  amountPaid: object;
  amountDue: object;
  notes: string | null;
  pdfUrl: string | null;
  isRecurring: boolean;
  recurringPeriod: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: InvoiceLineItemRecord[];
  payments: InvoicePaymentRecord[];
}

export interface InvoiceLineItemRecord {
  id: string;
  invoiceId: string;
  description: string;
  quantity: object;
  unitPrice: object;
  taxCode: string | null;
  taxRate: object;
  discount: object;
  total: object;
}

export interface InvoicePaymentRecord {
  id: string;
  invoiceId: string;
  amount: object;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: Date;
  createdAt: Date;
}

/*
 * Sprint S2 · Invoicing & Billing · Week 5–6
 * Owned by: Invoicing team
 * Next sprint: S3 — Expenses & Bank Reconciliation
 */
