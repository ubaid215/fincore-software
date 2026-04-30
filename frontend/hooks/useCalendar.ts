'use client';
// /hooks/useCalendar.ts
import { useState, useEffect, useCallback } from 'react';
import { toast }         from 'sonner';
import { calendarApi, type CalendarQuery } from '../lib/calendar-api';
import type { CalendarEvent } from '../types/api';

export function useCalendarEvents(orgId: string, query: CalendarQuery) {
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try { setEvents(await calendarApi.listEvents(orgId, query)); }
    catch { toast.error('Failed to load calendar events'); }
    finally { setLoading(false); }
  }, [orgId, JSON.stringify(query)]);

  useEffect(() => { void fetch(); }, [fetch]);
  return { events, loading, refetch: fetch, setEvents };
}

// src/hooks/useAppointments.ts
import { appointmentsApi, type AppointmentQuery } from '../lib/appointments-api';
import type { Appointment, PaginatedResult } from '../types/api';

export function useAppointments(orgId: string, query: AppointmentQuery = {}) {
  const [data,    setData]    = useState<PaginatedResult<Appointment> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try { setData(await appointmentsApi.list(orgId, query)); }
    catch { toast.error('Failed to load appointments'); }
    finally { setLoading(false); }
  }, [orgId, JSON.stringify(query)]);

  useEffect(() => { void fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useAppointment(orgId: string, id: string) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!orgId || !id) return;
    setLoading(true);
    try { setAppointment(await appointmentsApi.get(orgId, id)); }
    catch { toast.error('Appointment not found'); }
    finally { setLoading(false); }
  }, [orgId, id]);

  useEffect(() => { void fetch(); }, [fetch]);
  return { appointment, loading, refetch: fetch, setAppointment };
}