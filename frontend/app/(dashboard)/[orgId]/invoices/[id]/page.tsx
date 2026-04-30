'use client';
// src/app/(dashboard)/[orgId]/invoices/[id]/page.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter }             from 'next/navigation';
import Link                                 from 'next/link';
import { toast }                            from 'sonner';
import {
  Send, Ban, AlertTriangle, Download, RefreshCw,
  Pencil, Building2, Mail, Phone, Hash, MapPin,
  CreditCard, Receipt, ExternalLink, Copy, CheckCircle2,
} from 'lucide-react';
import { invoicesApi }             from '../../../../lib/invoices-api';
import { PageHeader }              from '../../../../components/shared/PageHeader';
import { Btn, Skeleton, EmptyState } from '../../../../components/shared/index';
import {
  InvoiceStatusBadge, InvoiceStatusStepper,
  PaymentModal, InvoiceTimeline, TotalsPanel,
} from '../../../../components/invoices/InvoiceShared';
import { fmtMoney, daysOverdue } from '../../../../types/invoice';
import type { Invoice, TimelineEntry, ComputedTotals } from '../../../../types/invoice';

// ─── Line items table ─────────────────────────────────────────────────────────

function LineItemsTable({ items, currency }: { items: Invoice['lineItems']; currency: string }) {
  const hasDiscount = items.some(l => Number(l.discount) > 0);
  const hasTax      = items.some(l => Number(l.taxRate)  > 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
            <th className="text-left py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>#</th>
            <th className="text-left py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Description</th>
            <th className="text-right py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Qty</th>
            <th className="text-right py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Unit Price</th>
            {hasDiscount && <th className="text-right py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Disc.</th>}
            {hasTax      && <th className="text-right py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Tax</th>}
            <th className="text-right py-2 px-3 text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {items.map((li, idx) => (
            <tr key={li.id} className="hover:bg-[--color-surface] transition-colors">
              <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-text-disabled)' }}>{idx + 1}</td>
              <td className="py-2.5 px-3">
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{li.description}</p>
                {li.taxCode && (
                  <span className="text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
                    {li.taxCode}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {Number(li.quantity).toLocaleString('en-PK', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {fmtMoney(li.unitPrice, currency)}
              </td>
              {hasDiscount && (
                <td className="py-2.5 px-3 text-right text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {Number(li.discount) > 0 ? `${(Number(li.discount) * 100).toFixed(0)}%` : '—'}
                </td>
              )}
              {hasTax && (
                <td className="py-2.5 px-3 text-right text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {Number(li.taxRate) > 0 ? `${(Number(li.taxRate) * 100).toFixed(0)}%` : '—'}
                </td>
              )}
              <td className="py-2.5 px-3 text-right font-mono font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {fmtMoney(li.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Payment history ──────────────────────────────────────────────────────────

function PaymentHistory({ payments, currency }: { payments: Invoice['payments']; currency: string }) {
  if (payments.length === 0) return (
    <p className="text-sm py-3" style={{ color: 'var(--color-text-tertiary)' }}>No payments recorded yet</p>
  );

  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
          style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-success-subtle)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {p.method.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {new Date(p.paidAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {p.reference && (
                  <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                    · {p.reference}
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="font-mono font-semibold text-sm flex-shrink-0" style={{ color: 'var(--color-success-text)' }}>
            + {fmtMoney(p.amount, p.currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const params  = useParams<{ orgId: string; id: string }>();
  const router  = useRouter();

  const [invoice,  setInvoice]  = useState<Invoice | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, tl] = await Promise.all([
        invoicesApi.get(params.orgId, params.id),
        invoicesApi.getTimeline(params.orgId, params.id),
      ]);
      setInvoice(inv);
      setTimeline(tl);
    } catch { toast.error('Invoice not found'); }
    finally  { setLoading(false); }
  }, [params.orgId, params.id]);

  useEffect(() => { void load(); }, [load]);

  const doAction = useCallback(async (action: 'send' | 'void' | 'dispute') => {
    if (!invoice) return;
    const confirmMsgs = {
      send:    null,
      void:    'Void this invoice? This cannot be undone.',
      dispute: 'Mark this invoice as disputed?',
    };
    if (confirmMsgs[action] && !confirm(confirmMsgs[action]!)) return;

    setActionLoading(action);
    try {
      let updated: Invoice;
      if (action === 'send')    updated = await invoicesApi.send(params.orgId, invoice.id);
      else if (action === 'void')    updated = await invoicesApi.void(params.orgId, invoice.id);
      else                           updated = await invoicesApi.dispute(params.orgId, invoice.id);
      setInvoice(updated);
      await invoicesApi.getTimeline(params.orgId, invoice.id).then(setTimeline);
      toast.success(`Invoice ${action === 'send' ? 'sent' : action === 'void' ? 'voided' : 'marked as disputed'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Action failed');
    } finally { setActionLoading(null); }
  }, [invoice, params]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="space-y-4 max-w-5xl">
      <div className="card space-y-4">
        <div className="flex items-center gap-4"><Skeleton className="h-7 w-36" /><Skeleton className="h-6 w-20 rounded-full" /></div>
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-4 w-full" />)}</div>
        <div className="card space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-4 w-full" />)}</div>
      </div>
    </div>
  );

  if (!invoice) return (
    <EmptyState icon={<Receipt className="w-7 h-7" />} title="Invoice not found"
      action={{ label: 'Back to invoices', href: `/${params.orgId}/invoices` }} />
  );

  const overdue   = daysOverdue(invoice.dueDate);
  const canSend   = invoice.status === 'DRAFT';
  const canPay    = ['SENT','VIEWED','PARTIALLY_PAID','OVERDUE','DISPUTED'].includes(invoice.status);
  const canVoid   = !['PAID','VOID'].includes(invoice.status);
  const canDispute = ['SENT','VIEWED','PARTIALLY_PAID','OVERDUE'].includes(invoice.status);
  const canEdit   = invoice.status === 'DRAFT';

  const totals: ComputedTotals = {
    subtotal:       Number(invoice.subtotal),
    discountAmount: Number(invoice.discountAmount),
    taxAmount:      Number(invoice.taxAmount),
    totalAmount:    Number(invoice.totalAmount),
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title={invoice.invoiceNumber}
        breadcrumbs={[
          { label: 'Invoices', href: `/${params.orgId}/invoices` },
          { label: invoice.invoiceNumber },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <InvoiceStatusBadge status={invoice.status} size="md" />
            {canEdit && (
              <Link href={`/${params.orgId}/invoices/${invoice.id}/edit`}>
                <Btn variant="outline" size="sm" icon={<Pencil className="w-3.5 h-3.5" />}>Edit</Btn>
              </Link>
            )}
            {canSend && (
              <Btn
                size="sm" icon={<Send className="w-3.5 h-3.5" />}
                loading={actionLoading === 'send'}
                onClick={() => doAction('send')}
              >
                Send Invoice
              </Btn>
            )}
            {canPay && (
              <Btn
                size="sm" icon={<CreditCard className="w-3.5 h-3.5" />}
                onClick={() => setShowPayModal(true)}
              >
                Record Payment
              </Btn>
            )}
            <Btn variant="outline" size="sm" icon={copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} onClick={copyLink}>
              {copied ? 'Copied' : 'Copy link'}
            </Btn>
            {invoice.pdfUrl && (
              <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
                <Btn variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />}>PDF</Btn>
              </a>
            )}
          </div>
        }
      />

      {/* ── Status stepper ────────────────────────────────────────────────── */}
      {!['VOID','DISPUTED'].includes(invoice.status) && (
        <div className="card overflow-x-auto">
          <InvoiceStatusStepper status={invoice.status} />
        </div>
      )}

      {/* ── Overdue alert ─────────────────────────────────────────────────── */}
      {invoice.status === 'OVERDUE' && overdue > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border"
          style={{ background: 'var(--color-danger-subtle)', borderColor: '#FCA5A5' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-danger-text)' }}>
              {overdue} day{overdue !== 1 ? 's' : ''} overdue
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-danger-text)' }}>
              Due {new Date(invoice.dueDate!).toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Balance {fmtMoney(invoice.amountDue, invoice.currency)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {canDispute && (
              <Btn variant="danger" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}
                loading={actionLoading === 'dispute'}
                onClick={() => doAction('dispute')}>
                Mark Disputed
              </Btn>
            )}
            {canVoid && (
              <Btn variant="outline" size="sm" icon={<Ban className="w-3.5 h-3.5" />}
                loading={actionLoading === 'void'}
                onClick={() => doAction('void')}>
                Void
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left — invoice body */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client + meta */}
          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  Bill To
                </p>
                <div className="space-y-1">
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {invoice.customer?.displayName ?? invoice.clientName}
                  </p>
                  {invoice.clientEmail && (
                    <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />{invoice.clientEmail}
                    </p>
                  )}
                  {invoice.customer?.phone && (
                    <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />{invoice.customer.phone}
                    </p>
                  )}
                  {invoice.clientAddress && (
                    <p className="text-sm flex items-start gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{invoice.clientAddress}
                    </p>
                  )}
                  {invoice.clientTaxId && (
                    <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Hash className="w-3.5 h-3.5 flex-shrink-0" />NTN: {invoice.clientTaxId}
                    </p>
                  )}
                  {invoice.customerId && (
                    <Link href={`/${params.orgId}/contacts/${invoice.customerId}`}
                      className="inline-flex items-center gap-1 text-xs mt-1"
                      style={{ color: 'var(--color-accent)' }}>
                      <ExternalLink className="w-3 h-3" />View contact
                    </Link>
                  )}
                </div>
              </div>

              {/* Dates & refs */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  Invoice Details
                </p>
                {[
                  { label: 'Issue Date', value: new Date(invoice.issueDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  invoice.dueDate ? { label: 'Due Date', value: new Date(invoice.dueDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) } : null,
                  invoice.purchaseOrder ? { label: 'PO Reference', value: invoice.purchaseOrder } : null,
                  { label: 'Currency', value: invoice.currency },
                ].filter(Boolean).map((row: any) => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{row.label}</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Line Items</h3>
            <LineItemsTable items={invoice.lineItems} currency={invoice.currency} />
          </div>

          {/* Terms & Notes */}
          {(invoice.terms || invoice.notes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {invoice.terms && (
                <div className="card">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Payment Terms</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{invoice.terms}</p>
                </div>
              )}
              {invoice.notes && (
                <div className="card">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Notes</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{invoice.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment history */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Payment History</h3>
              {canPay && (
                <Btn size="sm" variant="outline" icon={<CreditCard className="w-3.5 h-3.5" />} onClick={() => setShowPayModal(true)}>
                  Record Payment
                </Btn>
              )}
            </div>
            <PaymentHistory payments={invoice.payments} currency={invoice.currency} />
          </div>
        </div>

        {/* Right — sidebar */}
        <div className="space-y-4">
          {/* Totals */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Summary</h3>
            <TotalsPanel
              totals={totals}
              currency={invoice.currency}
              amountPaid={Number(invoice.amountPaid)}
            />
          </div>

          {/* Action buttons sidebar */}
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Actions</h3>
            {canSend && (
              <Btn fullWidth icon={<Send className="w-4 h-4" />} loading={actionLoading === 'send'} onClick={() => doAction('send')}>
                Send Invoice
              </Btn>
            )}
            {canPay && (
              <Btn fullWidth variant="outline" icon={<CreditCard className="w-4 h-4" />} onClick={() => setShowPayModal(true)}>
                Record Payment
              </Btn>
            )}
            {invoice.pdfUrl ? (
              <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="block">
                <Btn fullWidth variant="outline" icon={<Download className="w-4 h-4" />}>Download PDF</Btn>
              </a>
            ) : (
              <Btn fullWidth variant="outline" icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => invoicesApi.regeneratePdf(params.orgId, invoice.id).then(() => toast.success('PDF generation queued'))}>
                Generate PDF
              </Btn>
            )}
            {canDispute && !invoice.status.includes('OVERDUE') && (
              <Btn fullWidth variant="ghost" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}
                loading={actionLoading === 'dispute'}
                onClick={() => doAction('dispute')}>
                Mark Disputed
              </Btn>
            )}
            {canVoid && (
              <Btn fullWidth variant="danger" size="sm" icon={<Ban className="w-3.5 h-3.5" />}
                loading={actionLoading === 'void'}
                onClick={() => doAction('void')}>
                Void Invoice
              </Btn>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Activity</h3>
            <InvoiceTimeline entries={timeline} />
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayModal && (
        <PaymentModal
          invoice={invoice}
          orgId={params.orgId}
          onClose={() => setShowPayModal(false)}
          onSuccess={(updated) => {
            setInvoice(updated);
            setShowPayModal(false);
            invoicesApi.getTimeline(params.orgId, invoice.id).then(setTimeline);
          }}
        />
      )}
    </div>
  );
}