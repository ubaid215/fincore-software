// src/lib/invoices-api.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type {
  Invoice, InvoiceStats, TimelineEntry, InvoicePayment,
} from '../types/invoice';
import type { PaginatedResult as PR } from '../types/api';

const H = (orgId: string) => ({ headers: { 'X-Organization-Id': orgId } });

export interface InvoiceQuery {
  page?:         number;
  limit?:        number;
  status?:       string;
  customerId?:   string;
  clientName?:   string;
  currency?:     string;
  fromDate?:     string;
  toDate?:       string;
  overdueOnly?:  boolean;
  recurringOnly?: boolean;
}

export const invoicesApi = {
  // ── Stats & tracking ────────────────────────────────────────────────────
  getStats: (orgId: string) =>
    apiGet<InvoiceStats>('/invoices/stats', H(orgId)),

  getOverdue: (orgId: string) =>
    apiGet<Invoice[]>('/invoices/overdue', H(orgId)),

  getTimeline: (orgId: string, id: string) =>
    apiGet<TimelineEntry[]>(`/invoices/${id}/timeline`, H(orgId)),

  getFxRates: (orgId: string) =>
    apiGet<{ base: string; rates: Record<string, number> }>('/invoices/fx/rates', H(orgId)),

  // ── CRUD ────────────────────────────────────────────────────────────────
  list: (orgId: string, q: InvoiceQuery = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
    return apiGet<PR<Invoice>>(`/invoices?${p}`, H(orgId));
  },

  get: (orgId: string, id: string) =>
    apiGet<Invoice>(`/invoices/${id}`, H(orgId)),

  create: (orgId: string, data: Record<string, unknown>) =>
    apiPost<Invoice>('/invoices', data, H(orgId)),

  update: (orgId: string, id: string, data: Record<string, unknown>) =>
    apiPatch<Invoice>(`/invoices/${id}`, data, H(orgId)),

  remove: (orgId: string, id: string) =>
    apiDelete<{ deleted: boolean }>(`/invoices/${id}`, H(orgId)),

  // ── State transitions ────────────────────────────────────────────────────
  send:    (orgId: string, id: string) => apiPatch<Invoice>(`/invoices/${id}/send`,    {}, H(orgId)),
  viewed:  (orgId: string, id: string) => apiPatch<Invoice>(`/invoices/${id}/viewed`,  {}, H(orgId)),
  void:    (orgId: string, id: string) => apiPatch<Invoice>(`/invoices/${id}/void`,    {}, H(orgId)),
  dispute: (orgId: string, id: string) => apiPatch<Invoice>(`/invoices/${id}/dispute`, {}, H(orgId)),

  // ── Payments ─────────────────────────────────────────────────────────────
  getPayments: (orgId: string, id: string) =>
    apiGet<InvoicePayment[]>(`/invoices/${id}/payments`, H(orgId)),

  recordPayment: (orgId: string, id: string, data: {
    amount: number; currency?: string; method: string;
    reference?: string; notes?: string; paidAt: string;
  }) => apiPost<Invoice>(`/invoices/${id}/payments`, data, H(orgId)),

  // ── PDF ──────────────────────────────────────────────────────────────────
  regeneratePdf: (orgId: string, id: string) =>
    apiPost<{ jobId: string }>(`/invoices/${id}/pdf/regenerate`, {}, H(orgId)),
};