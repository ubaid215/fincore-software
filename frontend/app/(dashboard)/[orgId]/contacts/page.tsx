'use client';
// /app/(dashboard)/[orgId]/contacts/page.tsx
import { useState, useCallback }     from 'react';
import { useParams }                 from 'next/navigation';
import Link                          from 'next/link';
import { Users, Plus, Filter, LayoutGrid, List } from 'lucide-react';
import { useContactList }            from '../../../../hooks/useContacts';
import { PageHeader }                from '../../../../components/shared/PageHeader';
import {
  StatusBadge, EmptyState, Btn, SearchInput,
  Skeleton, Avatar, CONTACT_TYPE_BADGE,
} from '../../../../components/shared/index';
import type { ContactListItem, ContactType } from '../../../../types/api';

const TYPE_OPTIONS: { value: ContactType | ''; label: string }[] = [
  { value: '',         label: 'All types' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'VENDOR',   label: 'Vendors' },
  { value: 'BOTH',     label: 'Both' },
  { value: 'LEAD',     label: 'Leads' },
  { value: 'PARTNER',  label: 'Partners' },
  { value: 'INTERNAL', label: 'Internal' },
];

// ── Contact row ───────────────────────────────────────────────────────────────

function ContactRow({ contact, orgId }: { contact: ContactListItem; orgId: string }) {
  return (
    <Link
      href={`/${orgId}/contacts/${contact.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-[--color-surface] transition-colors group"
    >
      <Avatar name={contact.displayName} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {contact.displayName}
          </span>
          {contact.companyName && contact.displayName !== contact.companyName && (
            <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
              {contact.companyName}
            </span>
          )}
          <StatusBadge
            label={contact.contactType}
            variant={CONTACT_TYPE_BADGE[contact.contactType] ?? 'default'}
          />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {contact.email && (
            <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{contact.email}</span>
          )}
          {contact.phone && (
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{contact.phone}</span>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        {contact.city && (
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{contact.city}</span>
        )}
        {contact.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
            {tag}
          </span>
        ))}
      </div>

      <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }}>
        {contact.code}
      </span>
    </Link>
  );
}

// ── Contact card (grid view) ───────────────────────────────────────────────────

function ContactCard({ contact, orgId }: { contact: ContactListItem; orgId: string }) {
  return (
    <Link
      href={`/${orgId}/contacts/${contact.id}`}
      className="card hover:shadow-md transition-all duration-200 active:scale-[0.99] group"
    >
      <div className="flex items-start gap-3">
        <Avatar name={contact.displayName} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {contact.displayName}
          </p>
          {contact.jobTitle && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{contact.jobTitle}</p>
          )}
          <div className="mt-1.5">
            <StatusBadge label={contact.contactType} variant={CONTACT_TYPE_BADGE[contact.contactType] ?? 'default'} />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {contact.email && (
          <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{contact.email}</p>
        )}
        {contact.phone && (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{contact.phone}</p>
        )}
      </div>

      {contact.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const params  = useParams<{ orgId: string }>();
  const orgId   = params.orgId;
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [search,   setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType | ''>('');

  const { data, loading, setQuery } = useContactList(orgId, { limit: 50 });

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setQuery((q) => ({ ...q, search: val || undefined, page: 1 }));
  }, [setQuery]);

  const handleTypeFilter = useCallback((val: ContactType | '') => {
    setTypeFilter(val);
    setQuery((q) => ({ ...q, contactType: val || undefined, page: 1 }));
  }, [setQuery]);

  const contacts = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage your clients, vendors, and partners"
        actions={
          <Link href={`/${orgId}/contacts/new`}>
            <Btn icon={<Plus className="w-4 h-4" />}>New Contact</Btn>
          </Link>
        }
      />

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search name, email, phone…" />

        <div className="flex items-center gap-2 sm:ml-auto">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value as ContactType | '')}
            className="h-9 pl-3 pr-8 text-sm rounded-lg border"
            style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {(['list', 'grid'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-2 transition-colors"
                style={{
                  background: viewMode === mode ? 'var(--color-surface-2)' : 'var(--color-white)',
                  color:      viewMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                }}
                aria-label={`${mode} view`}
              >
                {mode === 'list' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results info ──────────────────────────────────────────────── */}
      {!loading && data && (
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          {data.total} contact{data.total !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      {loading ? (
        viewMode === 'list' ? (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title="No contacts yet"
          description="Add your first customer, vendor, or partner to get started."
          action={{ label: 'Add Contact', href: `/${orgId}/contacts/new` }}
        />
      ) : viewMode === 'list' ? (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-white)' }}>
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {contacts.map((c) => <ContactRow key={c.id} contact={c} orgId={orgId} />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {contacts.map((c) => <ContactCard key={c.id} contact={c} orgId={orgId} />)}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))} disabled={data.page <= 1}>Previous</Btn>
            <Btn variant="outline" size="sm" onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))} disabled={data.page >= data.totalPages}>Next</Btn>
          </div>
        </div>
      )}
    </div>
  );
}