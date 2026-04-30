'use client';
// src/components/invoices/index.tsx
// All invoice-specific shared components

import Link from 'next/link';
import {
  FilePlus, Send, Eye, CreditCard, CheckCircle2,
  AlertCircle, XCircle, RefreshCw, FileText, Clock,
  TrendingUp, AlertTriangle, DollarSign, FileEdit,
} from 'lucide-react';
import type { InvoiceStatus, InvoiceSummaryStats, TimelineEntry, TimelineIcon } from '../../types/invoice';
import { STATUS_CONFIG } from '../../types/invoice';

// ── Status Badge ───────────────────────────────────────────────────────────────

export function InvoiceStatusBadge({ status, size = 'sm' }: {
  status: InvoiceStatus;
  size?:  'xs' | 'sm' | 'md';
}) {
  const cfg   = STATUS_CONFIG[status];
  const sizes = { xs: 'text-[10px] px-1.5 py-0.5', sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${sizes[size]}`}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Days overdue chip ─────────────────────────────────────────────────────────

export function OverdueChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000);
  if (days <= 0) return null;
  return (
    <span
      className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: '#FBEAEA', color: '#B83030' }}
    >
      {days}d overdue
    </span>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accentColor, href }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accentColor: string; href?: string;
}) {
  const inner = (
    <div
      className="card flex flex-col gap-3 hover:shadow-md transition-all duration-200 cursor-pointer"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accentColor + '18' }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-semibold font-mono leading-none"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.025em' }}
        >
          {value}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5 font-medium" style={{ color: accentColor }}>{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function InvoiceSummaryCards({ stats, orgId, currency = 'PKR' }: {
  stats: InvoiceSummaryStats;
  orgId: string;
  currency?: string;
}) {
  const fmt = (v: string) => {
    const n = Number(v);
    if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(1)}K`;
    return `${currency} ${n.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Unpaid"
        value={fmt(stats.totalUnpaidAmount)}
        sub={`${stats.totalUnpaid} invoice${stats.totalUnpaid !== 1 ? 's' : ''}`}
        icon={<TrendingUp className="w-4 h-4" />}
        accentColor="var(--color-accent)"
        href={`/${orgId}/invoices?status=SENT`}
      />
      <StatCard
        label="Overdue"
        value={fmt(stats.totalOverdueAmount)}
        sub={`${stats.totalOverdue} invoice${stats.totalOverdue !== 1 ? 's' : ''}`}
        icon={<AlertTriangle className="w-4 h-4" />}
        accentColor="var(--color-danger)"
        href={`/${orgId}/invoices?overdueOnly=true`}
      />
      <StatCard
        label="Paid This Month"
        value={fmt(stats.paidThisMonthAmount)}
        sub={`${stats.paidThisMonth} invoice${stats.paidThisMonth !== 1 ? 's' : ''}`}
        icon={<CheckCircle2 className="w-4 h-4" />}
        accentColor="var(--color-success)"
        href={`/${orgId}/invoices?status=PAID`}
      />
      <StatCard
        label="Drafts"
        value={String(stats.draftCount)}
        icon={<FileEdit className="w-4 h-4" />}
        accentColor="var(--color-text-tertiary)"
        href={`/${orgId}/invoices?status=DRAFT`}
      />
    </div>
  );
}

// ── Totals panel ─────────────────────────────────────────────────────────────

export function TotalsPanel({
  currency, subtotal, discountAmount, taxAmount, totalAmount, amountPaid, amountDue,
}: {
  currency: string; subtotal: string; discountAmount: string; taxAmount: string;
  totalAmount: string; amountPaid: string; amountDue: string;
}) {
  const hasDiscount = Number(discountAmount) > 0;
  const hasTax      = Number(taxAmount) > 0;
  const hasPaid     = Number(amountPaid) > 0;

  const fmt = (v: string) =>
    Number(v).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const Row = ({ label, value, bold, color, prefix = '' }: {
    label: string; value: string; bold?: boolean; color?: string; prefix?: string;
  }) => (
    <div className={`flex justify-between items-center py-1.5 ${bold ? 'pt-3' : ''}`}>
      <span className="text-sm" style={{ color: color ?? 'var(--color-text-secondary)', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span
        className="text-sm font-mono"
        style={{ color: color ?? 'var(--color-text-primary)', fontWeight: bold ? 700 : 500 }}
      >
        {prefix}{currency} {fmt(value)}
      </span>
    </div>
  );

  return (
    <div className="space-y-0.5">
      <Row label="Subtotal"    value={subtotal} />
      {hasDiscount && <Row label="Discount" value={discountAmount} prefix="−" color="var(--color-danger)" />}
      {hasTax      && <Row label="Tax"      value={taxAmount}      prefix="+" />}
      <div className="border-t pt-1 mt-1" style={{ borderColor: 'var(--color-border)' }}>
        <Row label="Total"  value={totalAmount} bold />
      </div>
      {hasPaid && (
        <>
          <Row label="Amount Paid" value={amountPaid} prefix="−" color="var(--color-success)" />
          <div className="border-t pt-1 mt-1" style={{ borderColor: 'var(--color-border)' }}>
            <Row label="Balance Due" value={amountDue} bold color="var(--color-accent)" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Timeline icon map ─────────────────────────────────────────────────────────

const TIMELINE_ICONS: Record<TimelineIcon, React.ReactNode> = {
  'file-plus':   <FilePlus    className="w-3.5 h-3.5" />,
  'send':        <Send        className="w-3.5 h-3.5" />,
  'eye':         <Eye         className="w-3.5 h-3.5" />,
  'credit-card': <CreditCard  className="w-3.5 h-3.5" />,
  'check-circle': <CheckCircle2 className="w-3.5 h-3.5" />,
  'alert-circle': <AlertCircle className="w-3.5 h-3.5" />,
  'x-circle':    <XCircle     className="w-3.5 h-3.5" />,
  'refresh-cw':  <RefreshCw   className="w-3.5 h-3.5" />,
  'file-text':   <FileText    className="w-3.5 h-3.5" />,
  'clock':       <Clock       className="w-3.5 h-3.5" />,
};

const TIMELINE_COLORS: Record<TimelineEntry['variant'], { bg: string; color: string }> = {
  default: { bg: 'var(--color-surface-2)',      color: 'var(--color-text-tertiary)' },
  success: { bg: 'var(--color-success-subtle)', color: 'var(--color-success)'       },
  warning: { bg: 'var(--color-warning-subtle)', color: 'var(--color-warning)'       },
  danger:  { bg: 'var(--color-danger-subtle)',  color: 'var(--color-danger)'        },
  info:    { bg: 'var(--color-info-subtle)',     color: 'var(--color-info)'          },
};

// ── Timeline ──────────────────────────────────────────────────────────────────

export function InvoiceTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return (
    <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
      No activity yet
    </p>
  );

  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-4 top-0 bottom-0 w-px"
        style={{ background: 'var(--color-border)' }}
      />

      <div className="space-y-4">
        {entries.map((entry) => {
          const clr = TIMELINE_COLORS[entry.variant];
          return (
            <div key={entry.id} className="flex gap-3 relative">
              {/* Icon dot */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                style={{ background: clr.bg, color: clr.color }}
              >
                {TIMELINE_ICONS[entry.icon]}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {entry.label}
                  </p>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    {new Date(entry.createdAt).toLocaleString('en-PK', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: true,
                    })}
                  </span>
                </div>
                {entry.description && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {entry.description}
                  </p>
                )}
                {entry.actor && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    by {entry.actor}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Payment modal ─────────────────────────────────────────────────────────────

interface PaymentModalProps {
  currency:    string;
  amountDue:   string;
  onClose:     () => void;
  onSubmit:    (data: { amount: number; method: string; reference?: string; notes?: string; paidAt: string }) => Promise<void>;
}

export function PaymentModal({ currency, amountDue, onClose, onSubmit }: PaymentModalProps) {
  const [form, setForm]     = React.useState({
    amount:    amountDue,
    method:    'bank_transfer',
    reference: '',
    notes:     '',
    paidAt:    new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = React.useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      await onSubmit({
        amount:    Number(form.amount),
        method:    form.method,
        reference: form.reference || undefined,
        notes:     form.notes     || undefined,
        paidAt:    new Date(form.paidAt).toISOString(),
      });
      onClose();
    } finally { setSaving(false); }
  };

  const inputCls   = "w-full h-9 px-3 text-sm rounded-lg border";
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-white)' };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(26,25,22,0.5)' }} />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-xl"
        style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Record Payment
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-tertiary)' }}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent-text)' }}>
            Balance due: <strong className="font-mono">{currency} {Number(amountDue).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</strong>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{currency}</span>
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')}
                className={`${inputCls} pl-10`} style={inputStyle} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Method</label>
              <select value={form.method} onChange={set('method')} className={inputCls} style={inputStyle}>
                {['bank_transfer', 'cash', 'cheque', 'online', 'other'].map((m) => (
                  <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date *</label>
              <input type="date" value={form.paidAt} onChange={set('paidAt')} className={inputCls} style={inputStyle} required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Reference (optional)</label>
            <input type="text" placeholder="Transaction ID, cheque number…" value={form.reference}
              onChange={set('reference')} className={inputCls} style={inputStyle} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Any additional notes…"
              className="w-full px-3 py-2 text-sm rounded-lg border resize-none" style={inputStyle} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 text-sm rounded-lg border font-medium"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="h-9 px-4 text-sm rounded-lg font-medium text-white flex items-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--color-accent)' }}>
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// React import needed for hooks in this file
import React from 'react';