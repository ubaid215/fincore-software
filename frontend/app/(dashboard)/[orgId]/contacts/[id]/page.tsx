'use client';
// /app/(dashboard)/[orgId]/contacts/[id]/page.tsx
import { useState, useCallback }  from 'react';
import { useParams, useRouter }   from 'next/navigation';
import Link                       from 'next/link';
import { toast }                  from 'sonner';
import {
  Pencil, Trash2, Globe, Mail, Phone, MapPin,
  Building2, FileText, ShoppingCart, Package,
  CalendarClock, FolderOpen, Send, MessageSquare,
  Wallet, Hash, CreditCard, ExternalLink,
} from 'lucide-react';
import { useContact }             from '../../../../../hooks/useContacts';
import { contactsApi }            from '../../../../../lib/contacts-api';
import { PageHeader }             from '../../../../../components/shared/PageHeader';
import {
  StatusBadge, Btn, SmartButton, Avatar,
  Skeleton, EmptyState, CONTACT_TYPE_BADGE,
} from '../../../../../components/shared/index';

// ── Info row helper ────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, href }: {
  icon: React.ReactNode; label: string; value: string | null | undefined; href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        {href
          ? <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--color-accent)' }}>
              {value} <ExternalLink className="w-3 h-3" />
            </a>
          : <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        }
      </div>
    </div>
  );
}

// ── Chatter ───────────────────────────────────────────────────────────────────

function Chatter({ orgId, contactId, notes, onRefresh }: {
  orgId: string; contactId: string;
  notes: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
  onRefresh: () => void;
}) {
  const [mode,    setMode]    = useState<'note' | 'message'>('note');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await contactsApi.addNote(orgId, contactId, body.trim());
      setBody('');
      onRefresh();
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
    finally { setSending(false); }
  }, [orgId, contactId, body, onRefresh]);

  return (
    <div className="space-y-4">
      {/* Compose */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {(['message', 'note'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors capitalize"
              style={{
                background:   mode === m ? 'var(--color-white)'   : 'var(--color-surface)',
                color:        mode === m ? 'var(--color-accent)'   : 'var(--color-text-tertiary)',
                borderBottom: mode === m ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              {m === 'message' ? <Send className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
              {m === 'message' ? 'Send message' : 'Log note'}
            </button>
          ))}
        </div>
        {/* Textarea */}
        <div className="p-3 space-y-2" style={{ background: 'var(--color-white)' }}>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={mode === 'note' ? 'Log an internal note…' : 'Send a message to this contact…'}
            className="w-full text-sm resize-none rounded-lg border px-3 py-2 focus:outline-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-surface)' }}
          />
          <div className="flex justify-end">
            <Btn size="sm" loading={sending} onClick={handleSend} disabled={!body.trim()}>
              {mode === 'note' ? 'Add note' : 'Send'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-tertiary)' }}>No notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-3">
              <Avatar name={note.authorName} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="rounded-xl rounded-tl-sm p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{note.authorName}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {new Date(note.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{note.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const params  = useParams<{ orgId: string; id: string }>();
  const router  = useRouter();
  const { contact, loading, refetch } = useContact(params.orgId, params.id);
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'fields'>('details');
  const [deleting,  setDeleting]  = useState(false);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await contactsApi.remove(params.orgId, params.id);
      toast.success('Contact deleted');
      router.push(`/${params.orgId}/contacts`);
    } catch { toast.error('Failed to delete contact'); setDeleting(false); }
  }, [params]);

  if (loading) return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="card space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    </div>
  );

  if (!contact) return (
    <EmptyState icon={<FileText className="w-7 h-7" />} title="Contact not found"
      action={{ label: 'Back to contacts', href: `/${params.orgId}/contacts` }} />
  );

  const summary = contact.summary;
  const tabs = ['details', 'notes', 'fields'] as const;

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title={contact.displayName}
        breadcrumbs={[
          { label: 'Contacts', href: `/${params.orgId}/contacts` },
          { label: contact.displayName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/${params.orgId}/contacts/${params.id}/edit`}>
              <Btn variant="outline" size="sm" icon={<Pencil className="w-3.5 h-3.5" />}>Edit</Btn>
            </Link>
            <Btn variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} loading={deleting} onClick={handleDelete}>Delete</Btn>
          </div>
        }
      />

      {/* ── Header card ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start gap-4">
          <Avatar name={contact.displayName} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {contact.displayName}
              </h2>
              <StatusBadge label={contact.contactType} variant={CONTACT_TYPE_BADGE[contact.contactType] ?? 'default'} />
              {!contact.isActive && <StatusBadge label="Inactive" variant="danger" />}
            </div>
            {contact.jobTitle && <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{contact.jobTitle}</p>}
            {contact.companyName && (
              <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                <Building2 className="w-3.5 h-3.5" /> {contact.companyName}
              </p>
            )}
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--color-text-disabled)' }}>{contact.code}</p>
          </div>
        </div>

        {/* ── Smart buttons ────────────────────────────────────────── */}
        {summary && (
          <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <SmartButton label="Invoices"    count={summary.invoiceCount}      icon={<FileText className="w-4 h-4" />}      href={`/${params.orgId}/invoices?customerId=${params.id}`} />
            <SmartButton label="Invoiced"    count={`₨${Number(summary.invoicedAmount).toLocaleString()}`} icon={<Wallet className="w-4 h-4" />} color="var(--color-success)" />
            <SmartButton label="Sale Orders" count={summary.saleOrderCount}    icon={<ShoppingCart className="w-4 h-4" />}  href={`/${params.orgId}/sales?customerId=${params.id}`} />
            <SmartButton label="Purchases"   count={summary.purchaseOrderCount} icon={<Package className="w-4 h-4" />}      href={`/${params.orgId}/purchases?vendorId=${params.id}`} />
            <SmartButton label="Appointments" count={summary.appointmentCount} icon={<CalendarClock className="w-4 h-4" />} href={`/${params.orgId}/appointments?contactId=${params.id}`} />
            <SmartButton label="Documents"   count={summary.documentCount}     icon={<FolderOpen className="w-4 h-4" />}    href={`/${params.orgId}/documents?contactId=${params.id}`} />
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium capitalize transition-colors"
            style={{
              color:        activeTab === tab ? 'var(--color-accent)'         : 'var(--color-text-tertiary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            {tab === 'fields' ? 'Custom Fields' : tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact info */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Contact Information</h3>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              <InfoRow icon={<Mail className="w-4 h-4" />}    label="Email"    value={contact.email}    href={`mailto:${contact.email}`} />
              <InfoRow icon={<Mail className="w-4 h-4" />}    label="Email 2"  value={contact.email2}   href={`mailto:${contact.email2}`} />
              <InfoRow icon={<Phone className="w-4 h-4" />}   label="Phone"    value={contact.phone}    href={`tel:${contact.phone}`} />
              <InfoRow icon={<Phone className="w-4 h-4" />}   label="Phone 2"  value={contact.phone2}   href={`tel:${contact.phone2}`} />
              <InfoRow icon={<Globe className="w-4 h-4" />}   label="Website"  value={contact.website}  href={contact.website ?? undefined} />
              <InfoRow icon={<Hash className="w-4 h-4" />}    label="NTN / Tax ID" value={contact.taxId} />
            </div>
          </div>

          {/* Address */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Address</h3>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={contact.addressLine1} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address 2" value={contact.addressLine2} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="City / State" value={[contact.city, contact.state].filter(Boolean).join(', ')} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Country" value={contact.country} />
            </div>
          </div>

          {/* Finance */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Finance & Banking</h3>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              <InfoRow icon={<Wallet className="w-4 h-4" />}     label="Currency"       value={contact.currency} />
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Credit Limit"   value={contact.creditLimit ? `${contact.currency ?? ''} ${Number(contact.creditLimit).toLocaleString()}` : null} />
              <InfoRow icon={<FileText className="w-4 h-4" />}   label="Payment Terms"  value={contact.paymentTerms ? `${contact.paymentTerms} days` : null} />
              <InfoRow icon={<Building2 className="w-4 h-4" />}  label="Bank Name"      value={contact.bankName} />
              <InfoRow icon={<CreditCard className="w-4 h-4" />} label="IBAN"           value={contact.bankIban} />
            </div>
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent-text)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="max-w-2xl">
          <Chatter
            orgId={params.orgId}
            contactId={params.id}
            notes={(contact as any).notes_list ?? []}
            onRefresh={refetch}
          />
        </div>
      )}

      {activeTab === 'fields' && (
        <div className="card">
          {(contact as any).customFields?.length > 0 ? (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {(contact as any).customFields.map((cf: any) => (
                <div key={cf.id} className="py-2.5 flex items-start gap-3">
                  <span className="text-xs font-medium w-40 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {cf.fieldDef?.label ?? cf.fieldDefId}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{cf.value ?? '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-tertiary)' }}>
              No custom fields defined. Owners can add custom fields from Settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}