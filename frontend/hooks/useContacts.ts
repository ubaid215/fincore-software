'use client';
// /hooks/useContacts.ts
import { useState, useEffect, useCallback } from 'react';
import { toast }         from 'sonner';
import { contactsApi, type ContactQuery } from '../lib/contacts-api';
import type { Contact, ContactListItem, PaginatedResult } from '../types/api';

export function useContactList(orgId: string, initialQuery: ContactQuery = {}) {
  const [data,    setData]    = useState<PaginatedResult<ContactListItem> | null>(null);
  const [query,   setQuery]   = useState(initialQuery);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const result = await contactsApi.list(orgId, query);
      setData(result);
    } catch { toast.error('Failed to load contacts'); }
    finally  { setLoading(false); }
  }, [orgId, JSON.stringify(query)]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { data, query, setQuery, loading, refetch: fetch };
}

export function useContact(orgId: string, id: string) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orgId || !id) return;
    setLoading(true);
    try { setContact(await contactsApi.get(orgId, id)); }
    catch { toast.error('Contact not found'); }
    finally { setLoading(false); }
  }, [orgId, id]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { contact, loading, refetch: fetch };
}