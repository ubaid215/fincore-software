// src/types/invoice.ts

export type InvoiceStatus =
  | 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIALLY_PAID'
  | 'PAID'  | 'OVERDUE' | 'VOID' | 'DISPUTED';

export type RecurringPeriod = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type PaymentMethod   = 'bank_transfer' | 'cash' | 'cheque' | 'online' | 'other';

export interface InvoiceLineItem {
  id: string; invoiceId: string; productId: string | null;
  description: string; quantity: string; unitPrice: string;
  taxCode: string | null; taxRate: string; discount: string;
  total: string; sortOrder: number;
}

export interface InvoicePayment {
  id: string; invoiceId: string; amount: string; currency: string;
  exchangeRate: string; method: PaymentMethod; reference: string | null;
  notes: string | null; paidAt: string; createdAt: string;
}

export interface InvoiceCustomer {
  id: string | null; displayName: string; email: string | null;
  phone: string | null; taxId: string | null; contactType: string | null;
  addressLine1: string | null; city: string | null; country: string | null;
}

export interface Invoice {
  id: string; organizationId: string; invoiceNumber: string;
  customerId: string | null; clientName: string; clientEmail: string | null;
  clientAddress: string | null; clientTaxId: string | null;
  customer: InvoiceCustomer | null;
  purchaseOrder: string | null; reference: string | null;
  status: InvoiceStatus; issueDate: string; dueDate: string | null;
  sentAt: string | null; paidAt: string | null; voidedAt: string | null;
  currency: string; exchangeRate: string;
  subtotal: string; taxAmount: string; discountAmount: string;
  totalAmount: string; amountPaid: string; amountDue: string;
  terms: string | null; notes: string | null;
  pdfUrl: string | null; pdfS3Key: string | null;
  isRecurring: boolean; recurringPeriod: RecurringPeriod | null;
  lineItems: InvoiceLineItem[]; payments: InvoicePayment[];
  createdAt: string; updatedAt: string;
}

export interface InvoiceListItem {
  id: string; invoiceNumber: string; clientName: string;
  status: InvoiceStatus; currency: string; totalAmount: string;
  amountDue: string; issueDate: string; dueDate: string | null;
  paidAt: string | null; customerId: string | null;
}

export interface InvoiceSummaryStats {
  totalUnpaid: number; totalUnpaidAmount: string;
  totalOverdue: number; totalOverdueAmount: string;
  paidThisMonth: number; paidThisMonthAmount: string;
  draftCount: number;
}

export type TimelineIcon =
  | 'file-plus' | 'send' | 'eye' | 'credit-card' | 'check-circle'
  | 'alert-circle' | 'x-circle' | 'refresh-cw' | 'file-text' | 'clock';

export interface TimelineEntry {
  id: string; action: string; label: string; description: string;
  actor: string | null; actorId: string | null;
  metadata: Record<string, unknown>; createdAt: string;
  icon: TimelineIcon; variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export interface LineItemDraft {
  _key: string; productId?: string; description: string;
  quantity: string; unitPrice: string; taxCode: string;
  taxRate: string; discount: string;
}

export interface CreateInvoicePayload {
  customerId?: string; clientName: string; clientEmail?: string;
  clientAddress?: string; clientTaxId?: string; purchaseOrder?: string;
  issueDate: string; dueDate?: string; currency: string;
  exchangeRate?: number; terms?: string; notes?: string;
  isRecurring?: boolean; recurringPeriod?: RecurringPeriod;
  lineItems: Array<{
    productId?: string; description: string; quantity: number;
    unitPrice: number; taxCode?: string; taxRate?: number;
    discount?: number; sortOrder?: number;
  }>;
}

export interface RecordPaymentPayload {
  amount: number; currency?: string; exchangeRate?: number;
  method: PaymentMethod; reference?: string; notes?: string; paidAt: string;
}

export interface InvoiceStats {
  currency: string;
  countTotal: number;
  countDraft: number;
  countSent: number;
  countViewed: number;
  countPartial: number;
  countPaid: number;
  countOverdue: number;
  countDisputed: number;
  countVoid: number;
  totalInvoiced: string;
  totalOutstanding: string;
  totalOverdue: string;
  totalPaid: string;
}

export interface ComputedTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export function fmtMoney(value: string | number, currency: string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${currency} ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
}

export const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string; dot: string }> = {
  DRAFT:          { label: 'Draft',    color: '#5F5C55', bg: '#F1EFE8', dot: '#A8A49E' },
  SENT:           { label: 'Sent',     color: '#174E78', bg: '#E8F1F8', dot: '#1E6091' },
  VIEWED:         { label: 'Viewed',   color: '#1C5448', bg: '#EAF4F2', dot: '#2A7D6F' },
  PARTIALLY_PAID: { label: 'Partial',  color: '#7A5508', bg: '#FDF5E4', dot: '#92660A' },
  PAID:           { label: 'Paid',     color: '#1F5C33', bg: '#EAF3EE', dot: '#2D7D46' },
  OVERDUE:        { label: 'Overdue',  color: '#952626', bg: '#FBEAEA', dot: '#B83030' },
  VOID:           { label: 'Void',     color: '#A8A49E', bg: '#F1EFE8', dot: '#D4D1CC' },
  DISPUTED:       { label: 'Disputed', color: '#952626', bg: '#FBEAEA', dot: '#B83030' },
};