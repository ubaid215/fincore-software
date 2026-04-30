'use client';
// src/app/(dashboard)/[orgId]/invoices/new/page.tsx
import { useState, useCallback, useMemo } from 'react';
import { useParams, useRouter }  from 'next/navigation';
import { toast }                 from 'sonner';
import { nanoid }                from 'nanoid';
import {
  Plus, Trash2, GripVertical, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { invoicesApi }           from '../../../../../lib/invoices-api';
import { contactsApi }           from '../../../../../lib/contacts-api';
import { PageHeader }            from '../../../../../components/shared/PageHeader';
import { Btn }                   from '../../../../../components/shared/index';
import { TotalsPanel }           from '../../../../../components/invoices/index';
import type { LineItemDraft, RecurringPeriod } from '../../../../../types/invoice';
import type { ContactListItem }  from '../../../../../types/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD'];
const METHODS    = [
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY',  label: 'Annually' },
  { value: 'WEEKLY',    label: 'Weekly' },
  { value: 'BIWEEKLY',  label: 'Biweekly' },
];

function newLine(): LineItemDraft {
  return { _key: nanoid(6), description: '', quantity: '1', unitPrice: '', taxCode: '', taxRate: '0', discount: '0' };
}

// ── Line item row ─────────────────────────────────────────────────────────────

function LineItemRow({ line, index, onChange, onRemove, canRemove }: {
  line: LineItemDraft; index: number;
  onChange: (key: string, field: keyof LineItemDraft, value: string) => void;
  onRemove: (key: string) => void; canRemove: boolean;
}) {
  const qty   = Number(line.quantity)  || 0;
  const price = Number(line.unitPrice) || 0;
  const disc  = Number(line.discount)  || 0;
  const tax   = Number(line.taxRate)   || 0;
  const total = qty * price * (1 - disc) * (1 + tax);

  const inputCls = "w-full h-8 px-2 text-sm rounded-lg border focus:outline-none";
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-white)' };

  return (
    <div className="grid gap-2 p-3 rounded-xl border mb-2 relative group"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-white)',
               gridTemplateColumns: 'auto 1fr 64px 88px 72px 72px 80px auto' }}>
      {/* Drag handle */}
      <div className="flex items-center" style={{ color: 'var(--color-text-disabled)' }}>
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Description */}
      <input
        type="text"
        placeholder="Description of goods or services…"
        value={line.description}
        onChange={e => onChange(line._key, 'description', e.target.value)}
        className={`${inputCls} col-span-1`}
        style={inputStyle}
      />

      {/* Qty */}
      <input type="number" min="0" step="0.01" placeholder="Qty"
        value={line.quantity} onChange={e => onChange(line._key, 'quantity', e.target.value)}
        className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} />

      {/* Unit price */}
      <input type="number" min="0" step="0.01" placeholder="Price"
        value={line.unitPrice} onChange={e => onChange(line._key, 'unitPrice', e.target.value)}
        className={inputCls} style={{ ...inputStyle, textAlign: 'right' }} />

      {/* Tax rate % */}
      <div className="relative">
        <input type="number" min="0" max="100" step="0.01" placeholder="0"
          value={Number(line.taxRate) * 100 || ''}
          onChange={e => onChange(line._key, 'taxRate', String(Number(e.target.value) / 100))}
          className={`${inputCls} pr-5`} style={{ ...inputStyle, textAlign: 'right' }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
      </div>

      {/* Discount % */}
      <div className="relative">
        <input type="number" min="0" max="100" step="0.01" placeholder="0"
          value={Number(line.discount) * 100 || ''}
          onChange={e => onChange(line._key, 'discount', String(Number(e.target.value) / 100))}
          className={`${inputCls} pr-5`} style={{ ...inputStyle, textAlign: 'right' }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
      </div>

      {/* Total */}
      <div className="flex items-center justify-end">
        <span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {total.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Remove */}
      <button type="button" onClick={() => onRemove(line._key)} disabled={!canRemove}
        className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
        style={{ color: 'var(--color-danger)', background: 'var(--color-danger-subtle)' }}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router    = useRouter();

  // Form state
  const [clientMode, setClientMode] = useState<'contact' | 'manual'>('contact');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactListItem[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientAddress: '', clientTaxId: '',
    purchaseOrder: '', issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '', currency: 'PKR', terms: '', notes: '',
    isRecurring: false, recurringPeriod: 'MONTHLY' as RecurringPeriod,
  });

  const [lines, setLines] = useState<LineItemDraft[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Contact search
  const searchContacts = useCallback(async (q: string) => {
    if (q.length < 2) { setContactResults([]); return; }
    setSearchLoading(true);
    try {
      const r = await contactsApi.list(orgId, { search: q, limit: 8 });
      setContactResults(r.data);
    } finally { setSearchLoading(false); }
  }, [orgId]);

  const selectContact = (c: ContactListItem) => {
    setSelectedContact(c);
    setContactSearch(c.displayName);
    setContactResults([]);
    setForm(f => ({
      ...f,
      clientName:    c.displayName,
      clientEmail:   c.email   ?? '',
      clientAddress: c.city    ? `${c.city}, ${c.country ?? ''}`.trim() : '',
    }));
  };

  const clearContact = () => {
    setSelectedContact(null); setContactSearch('');
    setForm(f => ({ ...f, clientName: '', clientEmail: '', clientAddress: '', clientTaxId: '' }));
  };

  // Line item handlers
  const changeLine = (key: string, field: keyof LineItemDraft, value: string) =>
    setLines(ls => ls.map(l => l._key === key ? { ...l, [field]: value } : l));

  const removeLine = (key: string) => setLines(ls => ls.filter(l => l._key !== key));
  const addLine    = ()            => setLines(ls => [...ls, newLine()]);

  // Live totals
  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0, total = 0;
    for (const l of lines) {
      const qty = Number(l.quantity) || 0, price = Number(l.unitPrice) || 0;
      const disc = Number(l.discount) || 0, txRate = Number(l.taxRate) || 0;
      const base = qty * price;
      const discAmt = base * disc;
      const taxAmt  = (base - discAmt) * txRate;
      subtotal += base; discount += discAmt; tax += taxAmt;
      total    += base - discAmt + taxAmt;
    }
    const fmt = (n: number) => n.toFixed(4);
    return { subtotal: fmt(subtotal), discountAmount: fmt(discount), taxAmount: fmt(tax), totalAmount: fmt(total), amountPaid: '0', amountDue: fmt(total) };
  }, [lines]);

  // Submit
  const handleSubmit = useCallback(async (sendNow = false) => {
    if (!form.clientName.trim()) { toast.error('Client name is required'); return; }
    if (lines.some(l => !l.description.trim() || !l.unitPrice)) {
      toast.error('All line items must have a description and price'); return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId:     selectedContact?.id ?? undefined,
        clientName:     form.clientName,
        clientEmail:    form.clientEmail  || undefined,
        clientAddress:  form.clientAddress || undefined,
        clientTaxId:    form.clientTaxId  || undefined,
        purchaseOrder:  form.purchaseOrder || undefined,
        issueDate:      form.issueDate,
        dueDate:        form.dueDate || undefined,
        currency:       form.currency,
        terms:          form.terms   || undefined,
        notes:          form.notes   || undefined,
        isRecurring:    form.isRecurring,
        recurringPeriod: form.isRecurring ? form.recurringPeriod : undefined,
        lineItems: lines.map((l, i) => ({
          description: l.description,
          quantity:    Number(l.quantity)  || 1,
          unitPrice:   Number(l.unitPrice) || 0,
          taxCode:     l.taxCode  || undefined,
          taxRate:     Number(l.taxRate)  || 0,
          discount:    Number(l.discount) || 0,
          sortOrder:   i,
        })),
      };

      const invoice = await invoicesApi.create(orgId, payload);

      if (sendNow) {
        await invoicesApi.send(orgId, invoice.id);
        toast.success(`Invoice ${invoice.invoiceNumber} sent!`);
      } else {
        toast.success(`Invoice ${invoice.invoiceNumber} saved as draft`);
      }

      router.push(`/${orgId}/invoices/${invoice.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create invoice');
      setSaving(false);
    }
  }, [form, lines, selectedContact, orgId, router]);

  const inputCls   = "w-full h-9 px-3 text-sm rounded-lg border focus:outline-none";
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-white)' };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      {children}
    </div>
  );

  const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
      {children}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-4 pb-12">
      <PageHeader
        title="New Invoice"
        breadcrumbs={[{ label: 'Invoices', href: `/${orgId}/invoices` }, { label: 'New' }]}
        actions={
          <div className="flex gap-2">
            <Btn type="button" variant="outline" onClick={() => router.back()}>Cancel</Btn>
            <Btn type="button" variant="outline" loading={saving} onClick={() => handleSubmit(false)}>Save Draft</Btn>
            <Btn type="button" loading={saving} onClick={() => handleSubmit(true)}>Send Invoice</Btn>
          </div>
        }
      />

      {/* ── Client ───────────────────────────────────────────────────── */}
      <Section title="Bill To">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['contact', 'manual'] as const).map(mode => (
            <button key={mode} type="button" onClick={() => { setClientMode(mode); clearContact(); }}
              className="px-3 h-8 rounded-lg text-xs font-semibold border transition-all"
              style={{
                background:  clientMode === mode ? 'var(--color-accent-subtle)' : 'var(--color-white)',
                borderColor: clientMode === mode ? 'var(--color-accent)' : 'var(--color-border)',
                color:       clientMode === mode ? 'var(--color-accent-text)' : 'var(--color-text-secondary)',
              }}>
              {mode === 'contact' ? 'Search Contacts' : 'Enter Manually'}
            </button>
          ))}
        </div>

        {clientMode === 'contact' && (
          <div className="relative">
            <Field label="Search Contact">
              <input type="text" placeholder="Type name, email, or phone…"
                value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); searchContacts(e.target.value); }}
                className={inputCls} style={inputStyle} autoComplete="off" />
            </Field>
            {contactResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-lg overflow-hidden"
                style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}>
                {contactResults.map(c => (
                  <button key={c.id} type="button" onClick={() => selectContact(c)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[--color-surface] transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: 'var(--color-accent)' }}>
                      {c.displayName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.displayName}</p>
                      {c.email && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{c.email}</p>}
                    </div>
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
                      {c.contactType}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedContact && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-accent-subtle)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-accent-text)' }}>{selectedContact.displayName}</span>
                <button type="button" onClick={clearContact} className="ml-auto text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Remove</button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Client Name" required>
            <input type="text" value={form.clientName} onChange={setField('clientName')}
              placeholder="ACME Corporation" className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Client Email">
            <input type="email" value={form.clientEmail} onChange={setField('clientEmail')}
              placeholder="billing@acme.com" className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Client Address">
            <input type="text" value={form.clientAddress} onChange={setField('clientAddress')}
              placeholder="123 Main St, Karachi" className={`${inputCls} sm:col-span-1`} style={inputStyle} />
          </Field>
          <Field label="Client NTN / Tax ID">
            <input type="text" value={form.clientTaxId} onChange={setField('clientTaxId')}
              placeholder="1234567-8" className={inputCls} style={inputStyle} />
          </Field>
        </div>
      </Section>

      {/* ── Invoice details ───────────────────────────────────────────── */}
      <Section title="Invoice Details">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Issue Date" required>
            <input type="date" value={form.issueDate} onChange={setField('issueDate')} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Due Date">
            <input type="date" value={form.dueDate} onChange={setField('dueDate')} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={setField('currency')} className={inputCls} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="PO Reference">
            <input type="text" value={form.purchaseOrder} onChange={setField('purchaseOrder')}
              placeholder="PO-2025-042" className={inputCls} style={inputStyle} />
          </Field>
        </div>
      </Section>

      {/* ── Line items ────────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Line Items</h3>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Tip: Tax and discount are optional per line</p>
        </div>

        {/* Column headers */}
        <div className="hidden sm:grid gap-2 px-3 text-xs font-semibold tracking-wide"
          style={{ gridTemplateColumns: 'auto 1fr 64px 88px 72px 72px 80px auto', color: 'var(--color-text-tertiary)' }}>
          <span />
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Tax %</span>
          <span className="text-right">Disc %</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        {lines.map((line, i) => (
          <LineItemRow
            key={line._key} line={line} index={i}
            onChange={changeLine} onRemove={removeLine} canRemove={lines.length > 1}
          />
        ))}

        <button type="button" onClick={addLine}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed text-sm font-medium transition-colors hover:border-[--color-accent] hover:text-[--color-accent]"
          style={{ borderColor: 'var(--color-border-2)', color: 'var(--color-text-tertiary)' }}>
          <Plus className="w-4 h-4" />Add line item
        </button>

        {/* Totals */}
        <div className="flex justify-end pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-64">
            <TotalsPanel currency={form.currency} {...totals} />
          </div>
        </div>
      </div>

      {/* ── Terms & Notes ─────────────────────────────────────────────── */}
      <Section title="Terms & Notes">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Payment Terms</label>
            <textarea rows={3} value={form.terms} onChange={setField('terms')}
              placeholder="Payment due within 30 days. Late fee of 2% per month."
              className="w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none"
              style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={setField('notes')}
              placeholder="Thank you for your business!"
              className="w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none"
              style={inputStyle} />
          </div>
        </div>
      </Section>

      {/* ── Advanced / Recurring ──────────────────────────────────────── */}
      <div className="card">
        <button type="button" onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)' }}>
          Advanced Options
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
                style={{ background: form.isRecurring ? 'var(--color-accent)' : 'var(--color-border-2)' }}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                  style={{ transform: form.isRecurring ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Recurring Invoice</p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Auto-generate this invoice on a schedule</p>
              </div>
            </label>

            {form.isRecurring && (
              <div className="grid grid-cols-2 gap-3 pl-14">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Period</label>
                  <select value={form.recurringPeriod} onChange={setField('recurringPeriod')} className={inputCls} style={inputStyle}>
                    {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Action bar (sticky mobile) ────────────────────────────────── */}
      <div className="sticky bottom-4 flex justify-end gap-3 pt-2">
        <div className="flex gap-2 rounded-xl p-2 shadow-lg border" style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}>
          <Btn variant="outline" loading={saving} onClick={() => handleSubmit(false)}>Save Draft</Btn>
          <Btn loading={saving} onClick={() => handleSubmit(true)}>Send Invoice</Btn>
        </div>
      </div>
    </div>
  );
}