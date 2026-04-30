// /lib/contacts-api.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type {
  Contact, ContactListItem, ContactNote,
  CustomFieldDef, CustomFieldValue, ContactSmartSummary,
  PaginatedResult,
} from '../types/api';

export interface ContactQuery {
  search?:      string;
  contactType?: string;
  tag?:         string;
  isActive?:    boolean;
  page?:        number;
  limit?:       number;
}

export const contactsApi = {
  list: (orgId: string, q: ContactQuery = {}) => {
    const params = new URLSearchParams();
    if (q.search)      params.set('search',      q.search);
    if (q.contactType) params.set('contactType', q.contactType);
    if (q.tag)         params.set('tag',         q.tag);
    if (q.isActive !== undefined) params.set('isActive', String(q.isActive));
    if (q.page)        params.set('page',        String(q.page));
    if (q.limit)       params.set('limit',       String(q.limit));
    return apiGet<PaginatedResult<ContactListItem>>(
      `/contacts?${params}`,
      { headers: { 'X-Organization-Id': orgId } },
    );
  },

  get: (orgId: string, id: string) =>
    apiGet<Contact>(`/contacts/${id}`, { headers: { 'X-Organization-Id': orgId } }),

  getSummary: (orgId: string, id: string) =>
    apiGet<ContactSmartSummary>(`/contacts/${id}/summary`, { headers: { 'X-Organization-Id': orgId } }),

  create: (orgId: string, data: Partial<Contact>) =>
    apiPost<Contact>('/contacts', data, { headers: { 'X-Organization-Id': orgId } }),

  update: (orgId: string, id: string, data: Partial<Contact>) =>
    apiPatch<Contact>(`/contacts/${id}`, data, { headers: { 'X-Organization-Id': orgId } }),

  remove: (orgId: string, id: string) =>
    apiDelete<{ deleted: boolean }>(`/contacts/${id}`, { headers: { 'X-Organization-Id': orgId } }),

  // Notes
  addNote: (orgId: string, id: string, body: string) =>
    apiPost<ContactNote>(`/contacts/${id}/notes`, { body }, { headers: { 'X-Organization-Id': orgId } }),

  getNotes: (orgId: string, id: string) =>
    apiGet<ContactNote[]>(`/contacts/${id}/notes`, { headers: { 'X-Organization-Id': orgId } }),

  // Custom fields
  getFieldDefs: (orgId: string) =>
    apiGet<CustomFieldDef[]>('/contacts/custom-fields/definitions', { headers: { 'X-Organization-Id': orgId } }),

  createFieldDef: (orgId: string, data: {
    fieldKey: string; label: string; fieldType: string;
    isRequired?: boolean; sortOrder?: number; options?: unknown[];
  }) =>
    apiPost<CustomFieldDef>('/contacts/custom-fields/definitions', data, { headers: { 'X-Organization-Id': orgId } }),

  setFieldValues: (orgId: string, id: string, fields: { fieldDefId: string; value?: string }[]) =>
    apiPatch<CustomFieldValue[]>(`/contacts/${id}/custom-fields`, fields, { headers: { 'X-Organization-Id': orgId } }),
};