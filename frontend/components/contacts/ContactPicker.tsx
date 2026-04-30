'use client';
// Reusable contact search + select combobox.
// Drop this anywhere in the app where you need to pick a contact
// (invoices, sale orders, appointments, etc.).
//
// Usage:
//   <ContactPicker
//     orgId={orgId}
//     value={form.contactId}
//     selectedName={form.contactName}
//     onChange={(id, contact) => setForm(f => ({ ...f, contactId: id ?? '', contactName: contact?.displayName ?? '' }))}
//     contactType="CUSTOMER"   // optional: pre-filter by type
//   />

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X }                                from 'lucide-react';
import { contactsApi }                              from '../../lib/contacts-api';
import type { ContactListItem, ContactType }        from '../../types/api';

export interface ContactPickerProps {
  orgId:         string;
  value?:        string | null;
  selectedName?: string | null;
  onChange:      (id: string | null, contact: ContactListItem | null) => void;
  placeholder?:  string;
  disabled?:     boolean;
  contactType?:  ContactType;
}

export function ContactPicker({
  orgId, value, selectedName, onChange,
  placeholder = 'Search contacts…', disabled, contactType,
}: ContactPickerProps) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const runSearch = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await contactsApi.list(orgId, {
          search:      q || undefined,
          contactType: contactType || undefined,
          limit:       10,
        });
        setResults(data.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, [orgId, contactType]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    runSearch('');
  };

  const handleSelect = (contact: ContactListItem) => {
    onChange(contact.id, contact);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full h-9 px-3 text-sm rounded-lg border text-left flex items-center gap-2 transition-colors"
        style={{
          background:  'var(--color-white)',
          borderColor: open ? 'var(--color-accent)' : 'var(--color-border)',
          color:       value ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
          cursor:      disabled ? 'not-allowed' : 'pointer',
          opacity:     disabled ? 0.6 : 1,
        }}
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="flex-1 truncate">{selectedName || placeholder}</span>
        {value && (
          <span
            role="button"
            onClick={handleClear}
            className="flex-shrink-0 p-0.5 rounded hover:bg-[--color-surface] transition-colors"
          >
            <X className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border shadow-lg z-40 overflow-hidden"
          style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); runSearch(e.target.value); }}
              placeholder="Type to search…"
              className="w-full h-8 px-3 text-sm rounded-lg focus:outline-none"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                Searching…
              </p>
            )}
            {!loading && results.length === 0 && (
              <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                No contacts found
              </p>
            )}
            {!loading && results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[--color-surface] transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                  style={{ background: 'var(--color-accent)' }}
                >
                  {initials(c.displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {c.displayName}
                  </p>
                  {(c.email || c.companyName) && (
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {c.email || c.companyName}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }}>
                  {c.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
