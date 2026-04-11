// /lib/appointments-api.ts
import { apiGet, apiPost, apiPatch } from './api';
import type { Appointment, PaginatedResult } from '../types/api';

const H = (orgId: string) => ({ headers: { 'X-Organization-Id': orgId } });

export interface AppointmentQuery {
  status?:    string;
  contactId?: string;
  from?:      string;
  to?:        string;
  page?:      number;
  limit?:     number;
}

export const appointmentsApi = {
  list: (orgId: string, q: AppointmentQuery = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
    return apiGet<PaginatedResult<Appointment>>(`/appointments?${p}`, H(orgId));
  },

  getUpcoming: (orgId: string, days = 7) =>
    apiGet<Appointment[]>(`/appointments/upcoming?days=${days}`, H(orgId)),

  get: (orgId: string, id: string) =>
    apiGet<Appointment>(`/appointments/${id}`, H(orgId)),

  create: (orgId: string, data: {
    title: string; scheduledAt: string; durationMinutes?: number;
    notes?: string; location?: string; meetingUrl?: string; contactId?: string;
  }) => apiPost<Appointment>('/appointments', data, H(orgId)),

  update: (orgId: string, id: string, data: Partial<Appointment>) =>
    apiPatch<Appointment>(`/appointments/${id}`, data, H(orgId)),

  confirm:   (orgId: string, id: string) => apiPatch<Appointment>(`/appointments/${id}/confirm`,   {}, H(orgId)),
  complete:  (orgId: string, id: string) => apiPatch<Appointment>(`/appointments/${id}/complete`,  {}, H(orgId)),
  noShow:    (orgId: string, id: string) => apiPatch<Appointment>(`/appointments/${id}/no-show`,   {}, H(orgId)),
  cancel:    (orgId: string, id: string, cancelReason?: string) =>
    apiPatch<Appointment>(`/appointments/${id}/cancel`, { cancelReason }, H(orgId)),
};