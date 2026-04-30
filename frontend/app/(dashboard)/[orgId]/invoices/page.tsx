'use client';
// src/app/(dashboard)/[orgId]/invoices/page.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter }             from 'next/navigation';
import Link                                 from 'next/link';
import {
  Plus, FileText, TrendingUp, AlertTriangle,
  DollarSign, Clock, ExternalLink, ArrowUpDown,
  Download, Send,
} from 'lucide-react';
import { invoicesApi }           from '../../../../lib/invoices-api';
import { PageHeader }            from '../../../../components/shared/PageHeader';
import { Btn, SearchInput, Skeleton } from '../../../../components/shared/index';
import { InvoiceStatusBadge, KpiCard }  from '../../../../components/invoices/InvoiceShared';
import { fmtMoney, daysOverdue }        from '../../../../types/invoice';
import type {
  Invoice, InvoiceStats, InvoiceStatus, InvoiceListItem,
} from '../../../../types/invoice';
import type { PaginatedResult } from '../../../../types/api';

// ── Status tabs ───────────────────────────────────────────────────────────────

const STATUS_TABS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '',               label: 'All' },
  { value: 'DRAFT',          label: 'Draft' },
  { value: 'SENT',           label: 'Sent' },
  { value: 'VIEWED',         label: 'Viewed' },
  { value: 'PARTIALLY_PAID', label: 'Partial' },
  { value: 'PAID',           label: 'Paid' },
  { value: 'OVERDUE',        label: 'Overdue' },
  { value: 'DISPUTED',       label: 'Disputed' },
  { value: 'VOID',           label: 'Void' },
];

// ── Invoice table row ─────────────────────────────────────────────────────────

function InvoiceRow({ inv, orgId }: { inv: Invoice; orgId: string }) {
  const overdue   = daysOverdue(inv.dueDate);
  const isOverdue = inv.status === 'OVERDUE' && overdue > 0;

  return (
    <Link
      href={`/${orgId}/invoices/${inv.id}`}
      className="grid items-center gap-3 px-4 py-3 hover:bg-[--color-surface] transition-colors group"
      style={{ gridTemplateColumns: '1.5fr 1fr 90px 90px 120px 100px 32px' }}
    >
      {/* Invoice # + client */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
            {inv.invoiceNumber}
          </span>
          {isOverdue && (
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)' }}>
              {overdue}d
            </span>
          )}
        </div>
        <p className="text-sm font-medium truncate mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
          {inv.clientName}
        </p>
      </div>

      {/* Dates */}
      <div>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {new Date(inv.issueDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {inv.dueDate && (
          <p className="text-xs mt-0.5" style={{ color: isOverdue ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)' }}>
            Due {new Date(inv.dueDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>

      {/* Total */}
      <div className="text-right">
        <p className="text-sm font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {fmtMoney(inv.totalAmount, inv.currency)}
        </p>
        {Number(inv.amountPaid) > 0 && (
          <p className="text-xs font-mono" style={{ color: 'var(--color-success-text)' }}>
            -{fmtMoney(inv.amountPaid, inv.currency)}
          </p>
        )}
      </div>

      {/* Balance due */}
      <div className="text-right">
        <p
          className="text-sm font-mono font-semibold"
          style={{ color: Number(inv.amountDue) > 0 ? 'var(--color-accent)' : 'var(--color-text-disabled)' }}
        >
          {fmtMoney(inv.amountDue, inv.currency)}
        </p>
      </div>

      {/* Status */}
      <div className="flex justify-center">
        <InvoiceStatusBadge status={inv.status} />
      </div>

      {/* Currency */}
      <div>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
          {inv.currency}
        </span>
      </div>

      {/* Arrow */}
      <ExternalLink
        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--color-text-tertiary)' }}
      />
    </Link>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function InvoiceCard({ inv, orgId }: { inv: Invoice; orgId: string }) {
  const overdue = daysOverdue(inv.dueDate);
  return (
    <Link
      href={`/${orgId}/invoices/${inv.id}`}
      className="card hover:shadow-md transition-all duration-200 active:scale-[0.99] block"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
            {inv.invoiceNumber}
          </span>
          <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: 'var(--color-text-primary)' }}>
            {inv.clientName}
          </p>
        </div>
        <InvoiceStatusBadge status={inv.status} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
            {fmtMoney(inv.totalAmount, inv.currency)}
          </p>
          {inv.dueDate && (
            <p className="text-xs mt-0.5" style={{ color: overdue > 0 && inv.status === 'OVERDUE' ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)' }}>
              Due {new Date(inv.dueDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
              {overdue > 0 && inv.status === 'OVERDUE' && ` · ${overdue}d overdue`}
            </p>
          )}
        </div>
        {Number(inv.amountDue) > 0 && inv.status !== 'VOID' && (
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Balance</p>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
              {fmtMoney(inv.amountDue, inv.currency)}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const params  = useParams<{ orgId: string }>();
  const orgId   = params.orgId;
  const router  = useRouter();

  const [stats,       setStats]       = useState<InvoiceStats | null>(null);
  const [data,        setData]        = useState<PaginatedResult<Invoice> | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search,      setSearch]      = useState('');
  const [statusTab,   setStatusTab]   = useState<InvoiceStatus | ''>('');
  const [page,        setPage]        = useState(1);

  // Load stats once
  useEffect(() => {
    invoicesApi.getStats(orgId)
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [orgId]);

  // Load invoices
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.list(orgId, {
        status:     statusTab || undefined,
        clientName: search    || undefined,
        page,
        limit:      25,
      });
      setData(res as any);
    } catch { /* toast in api layer */ }
    finally  { setLoading(false); }
  }, [orgId, statusTab, search, page]);

  useEffect(() => { void load(); }, [load]);

  const invoices = (data as any)?.data ?? [];
  const currency = stats?.currency ?? 'PKR';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description="Create, track, and manage your invoices"
        actions={
          <Link href={`/${orgId}/invoices/new`}>
            <Btn icon={<Plus className="w-4 h-4" />}>New Invoice</Btn>
          </Link>
        }
      />

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : stats ? (
          <>
            <KpiCard
              label="Total Invoiced"
              value={fmtMoney(stats.totalInvoiced, currency)}
              icon={<TrendingUp className="w-5 h-5" />}
              color="var(--color-accent)"
              sub={`${stats.countTotal} invoices`}
            />
            <KpiCard
              label="Outstanding"
              value={fmtMoney(stats.totalOutstanding, currency)}
              icon={<Clock className="w-5 h-5" />}
              color="var(--color-info)"
              sub={`${stats.countSent + stats.countViewed + stats.countPartial} unpaid`}
              onClick={() => setStatusTab('SENT')}
            />
            <KpiCard
              label="Overdue"
              value={fmtMoney(stats.totalOverdue, currency)}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="var(--color-danger)"
              sub={stats.countOverdue > 0 ? `${stats.countOverdue} invoices` : 'None overdue'}
              onClick={() => { setStatusTab('OVERDUE'); setPage(1); }}
            />
            <KpiCard
              label="Collected"
              value={fmtMoney(stats.totalPaid, currency)}
              icon={<DollarSign className="w-5 h-5" />}
              color="var(--color-success)"
              sub={`${stats.countPaid} fully paid`}
              onClick={() => { setStatusTab('PAID'); setPage(1); }}
            />
          </>
        ) : null}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search client name or invoice #…"
        />
      </div>

      {/* ── Status tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
        {STATUS_TABS.map((tab) => {
          const count = stats
            ? tab.value === '' ? stats.countTotal
              : tab.value === 'DRAFT'          ? stats.countDraft
              : tab.value === 'SENT'           ? stats.countSent
              : tab.value === 'VIEWED'         ? stats.countViewed
              : tab.value === 'PARTIALLY_PAID' ? stats.countPartial
              : tab.value === 'PAID'           ? stats.countPaid
              : tab.value === 'OVERDUE'        ? stats.countOverdue
              : tab.value === 'DISPUTED'       ? stats.countDisputed
              : tab.value === 'VOID'           ? stats.countVoid
              : 0
            : null;

          const active = statusTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => { setStatusTab(tab.value as InvoiceStatus | ''); setPage(1); }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background:  active ? 'var(--color-accent)'        : 'var(--color-white)',
                color:       active ? 'white'                       : 'var(--color-text-secondary)',
                border:      `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {tab.label}
              {count != null && count > 0 && (
                <span
                  className="text-xs rounded-full px-1.5 py-0.5 font-semibold"
                  style={{
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-2)',
                    color:      active ? 'white'                    : 'var(--color-text-tertiary)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Table (desktop) ────────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-white)' }}>
        {/* Table header */}
        <div
          className="grid gap-3 px-4 py-2.5 border-b text-xs font-semibold"
          style={{
            gridTemplateColumns: '1.5fr 1fr 90px 90px 120px 100px 32px',
            borderColor: 'var(--color-border)',
            color:       'var(--color-text-tertiary)',
            background:  'var(--color-surface)',
          }}
        >
          <span>Invoice / Client</span>
          <span>Date</span>
          <span className="text-right">Total</span>
          <span className="text-right">Balance</span>
          <span className="text-center">Status</span>
          <span>Currency</span>
          <span />
        </div>

        {/* Rows */}
        {loading ? (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid gap-3 px-4 py-3 items-center" style={{ gridTemplateColumns: '1.5fr 1fr 90px 90px 120px 100px 32px' }}>
                <div className="space-y-1.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-36" /></div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full ml-auto" />
                <Skeleton className="h-4 w-full ml-auto" />
                <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                <Skeleton className="h-5 w-10 rounded" />
                <div />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-disabled)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>No invoices found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {statusTab ? `No ${statusTab.toLowerCase()} invoices` : 'Create your first invoice to get started'}
            </p>
            <Link href={`/${orgId}/invoices/new`} className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
              <Plus className="w-4 h-4" /> New Invoice
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {invoices.map((inv: Invoice) => <InvoiceRow key={inv.id} inv={inv} orgId={orgId} />)}
          </div>
        )}
      </div>

      {/* ── Card grid (mobile) ─────────────────────────────────────────────── */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="card space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-3 w-full" /></div>)
          : invoices.map((inv: Invoice) => <InvoiceCard key={inv.id} inv={inv} orgId={orgId} />)
        }
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {data && (data as any).totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Page {(data as any).page} of {(data as any).totalPages} · {(data as any).total} invoices
          </p>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Previous</Btn>
            <Btn variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= (data as any).totalPages}>Next</Btn>
          </div>
        </div>
      )}
    </div>
  );
}