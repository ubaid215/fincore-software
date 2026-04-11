// /lib/calendar-api.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type { CalendarEvent, EventAttendee } from '../types/api';

const H = (orgId: string) => ({ headers: { 'X-Organization-Id': orgId } });

export interface CalendarQuery {
  from?:        string;
  to?:          string;
  organizerId?: string;
  contactId?:   string;
  status?:      string;
}

export const calendarApi = {
  listEvents: (orgId: string, q: CalendarQuery = {}) => {
    const p = new URLSearchParams();
    if (q.from)         p.set('from',         q.from);
    if (q.to)           p.set('to',           q.to);
    if (q.organizerId)  p.set('organizerId',  q.organizerId);
    if (q.contactId)    p.set('contactId',    q.contactId);
    if (q.status)       p.set('status',       q.status);
    return apiGet<CalendarEvent[]>(`/calendar/events?${p}`, H(orgId));
  },

  getUpcoming: (orgId: string, days = 7) =>
    apiGet<CalendarEvent[]>(`/calendar/events/upcoming?days=${days}`, H(orgId)),

  getEvent: (orgId: string, id: string) =>
    apiGet<CalendarEvent>(`/calendar/events/${id}`, H(orgId)),

  createEvent: (orgId: string, data: Partial<CalendarEvent> & { attendees?: { userId?: string; email?: string; name?: string }[] }) =>
    apiPost<CalendarEvent>('/calendar/events', data, H(orgId)),

  updateEvent: (orgId: string, id: string, data: Partial<CalendarEvent>) =>
    apiPatch<CalendarEvent>(`/calendar/events/${id}`, data, H(orgId)),

  deleteEvent: (orgId: string, id: string) =>
    apiDelete<{ deleted: boolean }>(`/calendar/events/${id}`, H(orgId)),

  addAttendee: (orgId: string, eventId: string, data: { userId?: string; email?: string; name?: string }) =>
    apiPost<EventAttendee>(`/calendar/events/${eventId}/attendees`, data, H(orgId)),

  updateAttendeeStatus: (orgId: string, eventId: string, attendeeId: string, status: string) =>
    apiPatch<EventAttendee>(`/calendar/events/${eventId}/attendees/${attendeeId}/status`, { status }, H(orgId)),

  removeAttendee: (orgId: string, eventId: string, attendeeId: string) =>
    apiDelete<{ removed: boolean }>(`/calendar/events/${eventId}/attendees/${attendeeId}`, H(orgId)),
};