'use client';
// src/components/invoices/InvoiceShared.tsx
// All reusable invoice-specific components in one file

import { useState, useCallback } from 'react';
import { toast }   from 'sonner';
import {
  CheckCircle2, Clock, Eye, CreditCard, Ban, AlertTriangle,
  FileText, TrendingUp, TrendingDown, Minus, X, DollarSign,
} from 'lucide-react';
import type { InvoiceStatus, TimelineEntry, Invoice, ComputedTotals } from '../../types/invoice';
import { fmtMoney, daysOverdue } from '../../types/invoice';
import { invoicesApi }           from '../../lib/invoices-api';
import { Btn }                   from '../shared/index';

// ─── Status config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<InvoiceStatus, {
  label: string; color: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  DRAFT:          { label: 'Draft',          color: '#5F5C55', bg: '#F1EFE8', border: '#D4D1CC', icon: <FileText className="w-3 h-3" /> },
  SENT:           { label: 'Sent',           color: '#174E78', bg: '#E8F1F8', border: '#93C5FD', icon: <Clock className="w-3 h-3" /> },
  VIEWED:         { label: 'Viewed',         color: '#1C5448', bg: '#EAF4F2', border: '#6EE7B7', icon: <Eye className="w-3 h-3" /> },
  PARTIALLY_PAID: { label: 'Partial',        color: '#7A5508', bg: '#FDF5E4', border: '#FCD34D', icon: <Minus className="w-3 h-3" /> },
  PAID:           { label: 'Paid',           color: '#1F5C33', bg: '#EAF3EE', border: '#86EFAC', icon: <CheckCircle2 className="w-3 h-3" /> },
  OVERDUE:        { label: 'Overdue',        color: '#952626', bg: '#FBEAEA', border: '#FCA5A5', icon: <AlertTriangle className="w-3 h-3" /> },
  VOID:           { label: 'Void',           color: '#A8A49E', bg: '#F1EFE8', border: '#D4D1CC', icon: <Ban className="w-3 h-3" /> },
  DISPUTED:       { label: 'Disputed',       color: '#92370A', bg: '#FEF3C7', border: '#FCD34D', icon: <AlertTriangle className="w-3 h-3" /> },
};

// ─── Invoice status badge ─────────────────────────────────────────────────────

export function InvoiceStatusBadge({ status, size = 'sm' }: { status: InvoiceStatus; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-1.5' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap border ${sizes[size]}`}
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, trend, color, icon, onClick }: {
  label: string; value: string; sub?: string;
  trend?: 'up' | 'down' | 'neutral'; color: string;
  icon: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`card group transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '18' }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && trend !== 'neutral' && (
          <span style={{ color: trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </span>
        )}
      </div>
      <div className="mt-3 min-w-0">
        <p
          className="text-xl font-bold font-mono truncate"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
        >
          {value}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5 font-medium" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Totals panel ─────────────────────────────────────────────────────────────

export function TotalsPanel({ totals, currency, amountPaid }: {
  totals: ComputedTotals; currency: string; amountPaid?: number;
}) {
  const fmt = (n: number) => fmtMoney(n, currency);
  const hasDiscount = totals.discountAmount > 0;
  const hasTax      = totals.taxAmount > 0;
  const hasPaid     = (amountPaid ?? 0) > 0;
  const balance     = Math.max(0, totals.totalAmount - (amountPaid ?? 0));

  return (
    <div className="space-y-1.5 min-w-[220px]">
      <Row label="Subtotal" value={fmt(totals.subtotal)} muted />
      {hasDiscount && <Row label="Discount" value={`- ${fmt(totals.discountAmount)}`} color="var(--color-danger)" />}
      {hasTax      && <Row label="Tax"      value={`+ ${fmt(totals.taxAmount)}`} muted />}
      <div className="border-t pt-1.5" style={{ borderColor: 'var(--color-border)' }}>
        <Row label="Total" value={fmt(totals.totalAmount)} bold />
      </div>
      {hasPaid && (
        <>
          <Row label="Amount Paid" value={`- ${fmt(amountPaid!)}`} color="var(--color-success)" />
          <div className="border-t pt-1.5" style={{ borderColor: 'var(--color-border)' }}>
            <Row label="Balance Due" value={fmt(balance)} bold large color={balance > 0 ? 'var(--color-accent)' : 'var(--color-success)'} />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, muted, bold, large, color }: {
  label: string; value: string; muted?: boolean; bold?: boolean; large?: boolean; color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`${muted ? 'text-xs' : 'text-sm'}`} style={{ color: muted ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span
        className={`font-mono ${bold ? 'font-bold' : 'font-medium'} ${large ? 'text-lg' : 'text-sm'}`}
        style={{ color: color ?? 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Status flow stepper ──────────────────────────────────────────────────────

const FLOW: InvoiceStatus[] = ['DRAFT', 'SENT', 'VIEWED', 'PAID'];

export function InvoiceStatusStepper({ status }: { status: InvoiceStatus }) {
  const isTerminal   = ['VOID', 'DISPUTED'].includes(status);
  const currentIndex = FLOW.indexOf(status as InvoiceStatus);
  const partialIdx   = FLOW.indexOf('PAID');   // PARTIALLY_PAID sits before PAID

  return (
    <div className="flex items-center gap-0">
      {FLOW.map((step, idx) => {
        const cfg  = STATUS_CONFIG[step];
        const done = isTerminal ? false
          : step === 'PAID' && status === 'PARTIALLY_PAID' ? false
          : currentIndex >= idx;
        const active = step === status || (step === 'PAID' && status === 'PARTIALLY_PAID');

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                style={{
                  background:  done || active ? 'var(--color-accent)' : 'var(--color-surface)',
                  borderColor: done || active ? 'var(--color-accent)' : 'var(--color-border)',
                  color:       done || active ? 'white' : 'var(--color-text-tertiary)',
                }}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className="text-xs mt-1 whitespace-nowrap" style={{
                color: done || active ? 'var(--color-accent-text)' : 'var(--color-text-tertiary)',
                fontWeight: active ? 600 : 400,
              }}>
                {step === 'PAID' && status === 'PARTIALLY_PAID' ? 'Partial' : cfg.label}
              </span>
            </div>
            {idx < FLOW.length - 1 && (
              <div className="w-10 sm:w-16 h-0.5 mx-1 mb-4 transition-all"
                style={{ background: done ? 'var(--color-accent)' : 'var(--color-border)' }} />
            )}
          </div>
        );
      })}
      {isTerminal && (
        <div className="ml-4 flex items-center gap-1.5">
          <div className="w-0.5 h-8 rounded-full" style={{ background: 'var(--color-border)' }} />
          <InvoiceStatusBadge status={status} />
        </div>
      )}
    </div>
  );
}

// ─── Activity timeline ────────────────────────────────────────────────────────

export function InvoiceTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return (
    <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>No activity yet</p>
  );

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-4 bottom-4 w-px" style={{ background: 'var(--color-border)' }} />
      <div className="space-y-4">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 relative z-10"
              style={{ background: 'var(--color-white)', border: '2px solid var(--color-border)' }}
            >
              {e.icon}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{e.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {e.actor && (
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    by {e.actor}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                  {new Date(e.createdAt).toLocaleString('en-PK', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Record payment modal ─────────────────────────────────────────────────────

interface PaymentModalProps {
  invoice:   Invoice;
  orgId:     string;
  onClose:   () => void;
  onSuccess: (updated: Invoice) => void;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online / Card' },
  { value: 'other',         label: 'Other' },
];

export function PaymentModal({ invoice, orgId, onClose, onSuccess }: PaymentModalProps) {
  const outstanding = Number(invoice.amountDue);
  const [form, setForm] = useState({
    amount:    outstanding.toFixed(2),
    currency:  invoice.currency,
    method:    'bank_transfer',
    reference: '',
    notes:     '',
    paidAt:    new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0)         { toast.error('Enter a valid amount'); return; }
    if (amount > outstanding + 0.001)   { toast.error(`Amount exceeds balance (${invoice.currency} ${outstanding.toFixed(2)})`); return; }

    setSaving(true);
    try {
      const updated = await invoicesApi.recordPayment(orgId, invoice.id, {
        amount, currency: form.currency, method: form.method,
        reference: form.reference || undefined,
        notes:     form.notes     || undefined,
        paidAt:    form.paidAt,
      });
      toast.success('Payment recorded');
      onSuccess(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to record payment');
    } finally { setSaving(false); }
  }, [form, invoice, orgId, onSuccess, outstanding]);

  const inputCls   = "w-full h-9 px-3 text-sm rounded-lg border";
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-white)' };

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(26,25,22,0.5)' }} />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Record Payment</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              Outstanding: <strong>{fmtMoney(outstanding, invoice.currency)}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-text-tertiary)' }}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {/* Amount + currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Amount *</label>
              <input
                type="number" step="0.01" min="0.01" max={outstanding + 0.01}
                value={form.amount} onChange={set('amount')}
                className={inputCls} style={inputStyle} autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Currency</label>
              <input type="text" maxLength={3} value={form.currency} onChange={set('currency')} className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Method */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Payment Method *</label>
            <select value={form.method} onChange={set('method')} className={inputCls} style={inputStyle}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Date + reference */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date *</label>
              <input type="date" value={form.paidAt} onChange={set('paidAt')} className={inputCls} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Reference</label>
              <input type="text" placeholder="TXN-001" value={form.reference} onChange={set('reference')} className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Notes</label>
            <textarea rows={2} placeholder="Optional notes…" value={form.notes} onChange={set('notes')}
              className="w-full px-3 py-2 text-sm rounded-lg border resize-none" style={inputStyle} />
          </div>

          {/* Quick fill button */}
          {outstanding > 0 && (
            <button
              type="button"
              className="text-xs font-medium"
              style={{ color: 'var(--color-accent)' }}
              onClick={() => setForm(f => ({ ...f, amount: outstanding.toFixed(2) }))}
            >
              Fill full balance ({fmtMoney(outstanding, invoice.currency)})
            </button>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" size="sm" loading={saving} icon={<DollarSign className="w-3.5 h-3.5" />}>
              Record Payment
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Contact picker ───────────────────────────────────────────────────────────

import { contactsApi } from '../../lib/contacts-api';

export function ContactPicker({ orgId, value, onSelect }: {
  orgId:    string;
  value:    string;
  onSelect: (contact: { id: string; displayName: string; email: string | null; addressLine1: string | null; city: string | null; country: string | null; taxId: string | null }) => void;
}) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await contactsApi.list(orgId, {
        search: q, contactType: 'CUSTOMER', isActive: true, limit: 8,
      });
      setResults(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [orgId]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search contacts by name or email…"
        value={value || query}
        onChange={e => { search(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full h-9 px-3 text-sm rounded-lg border"
        style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      />
      {open && (results.length > 0 || loading) && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-lg overflow-hidden"
          style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}
        >
          {loading && <p className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Searching…</p>}
          {results.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[--color-surface] transition-colors"
              onClick={() => { onSelect(c); setOpen(false); setQuery(''); setResults([]); }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5"
                style={{ background: 'var(--color-accent)' }}
              >
                {c.displayName[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.displayName}</p>
                {c.email && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{c.email}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}