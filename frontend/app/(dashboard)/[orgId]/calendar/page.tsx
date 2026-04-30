/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';
// /app/(dashboard)/[orgId]/calendar/page.tsx
import { useState, useCallback, useMemo } from 'react';
import { useParams }                       from 'next/navigation';
import { toast }                           from 'sonner';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock,
  MapPin, Users, Calendar, List, Grid3X3,
  Repeat, Link2,
} from 'lucide-react';
import { useCalendarEvents }               from '../../../../hooks/useCalendar';
import { calendarApi }                     from '../../../../lib/calendar-api';
import { PageHeader }                      from '../../../../components/shared/PageHeader';
import { Btn, StatusBadge, Avatar, EVENT_STATUS_BADGE } from '../../../../components/shared/index';
import type { CalendarEvent }              from '../../../../types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function startOfMonth(d: Date)  { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)    { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Event pill ────────────────────────────────────────────────────────────────

function EventPill({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const color = event.color ?? 'var(--color-accent)';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate transition-opacity hover:opacity-80"
      style={{ background: color + '22', color, borderLeft: `3px solid ${color}` }}
      title={event.title}
    >
      {!event.allDay && <span className="mr-1 opacity-70">{fmtTime(event.startAt)}</span>}
      {event.title}
    </button>
  );
}

// ── Event modal ────────────────────────────────────────────────────────────────

interface EventModalProps {
  event?:   Partial<CalendarEvent>;
  date?:    Date;
  onClose:  () => void;
  onSave:   (data: Partial<CalendarEvent>) => Promise<void>;
  onDelete?: () => Promise<void>;
  orgId:    string;
}

function EventModal({ event, date, onClose, onSave, onDelete, orgId }: EventModalProps) {
  const isEdit = !!event?.id;
  const defaultStart = date ?? new Date();
  const defaultEnd   = new Date(defaultStart.getTime() + 60 * 60_000);

  const toLocal = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const toISO = (local: string) => new Date(local).toISOString();

  const [form, setForm] = useState({
    title:       event?.title       ?? '',
    description: event?.description ?? '',
    location:    event?.location    ?? '',
    startAt:     event?.startAt     ? toLocal(event.startAt) : toLocal(defaultStart.toISOString()),
    endAt:       event?.endAt       ? toLocal(event.endAt)   : toLocal(defaultEnd.toISOString()),
    allDay:      event?.allDay      ?? false,
    color:       event?.color       ?? 'var(--color-accent)',
    visibility:  event?.visibility  ?? 'TEAM',
    status:      event?.status      ?? 'CONFIRMED',
    isRecurring: event?.isRecurring ?? false,
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k: string) => (v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        startAt: toISO(form.startAt),
        endAt:   toISO(form.endAt),
      });
      onClose();
    } catch { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm('Delete this event?')) return;
    setDeleting(true);
    try { await onDelete(); onClose(); }
    catch { setDeleting(false); }
  };

  const COLORS = ['#2A7D6F','#3b82f6','#8b5cf6','#ec4899','#f97316','#eab308','#10b981','#ef4444'];

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(26,25,22,0.5)' }} />
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-xl"
        style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--color-text-tertiary)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <input
            autoFocus
            type="text"
            placeholder="Event title"
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            className="w-full h-10 px-3 text-base font-medium rounded-lg border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          />

          {/* All-day toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => set('allDay')(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>All day</span>
          </label>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Start</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? form.startAt.slice(0,10) : form.startAt}
                onChange={(e) => set('startAt')(e.target.value)}
                className="w-full h-9 px-2 text-sm rounded-lg border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>End</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? form.endAt.slice(0,10) : form.endAt}
                onChange={(e) => set('endAt')(e.target.value)}
                className="w-full h-9 px-2 text-sm rounded-lg border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Location or meeting URL"
              value={form.location}
              onChange={(e) => set('location')(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* Description */}
          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border resize-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          />

          {/* Color + visibility row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Color swatches */}
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color')(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background:  c,
                    outline:     form.color === c ? `2px solid ${c}` : undefined,
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>

            {/* Visibility */}
            <select
              value={form.visibility}
              onChange={(e) => set('visibility')(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border ml-auto"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <option value="TEAM">Team</option>
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>

            {/* Status */}
            <select
              value={form.status}
              onChange={(e) => set('status')(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <option value="CONFIRMED">Confirmed</option>
              <option value="TENTATIVE">Tentative</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            {isEdit && onDelete && (
              <Btn variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Delete</Btn>
            )}
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn size="sm" loading={saving} onClick={handleSave}>
              {isEdit ? 'Save changes' : 'Create event'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({ year, month, events, today, onDayClick, onEventClick }: {
  year: number; month: number; events: CalendarEvent[]; today: Date;
  onDayClick: (d: Date) => void; onEventClick: (e: CalendarEvent) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
    ...Array(totalCells - startPad - lastDay.getDate()).fill(null),
  ];

  const eventsForDay = (d: Date) =>
    events.filter((e) => {
      const start = new Date(e.startAt);
      const end   = new Date(e.endAt);
      return d >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             d <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });

  return (
    <div className="flex flex-col flex-1">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${totalCells / 7}, minmax(100px, 1fr))` }}>
        {cells.map((date, idx) => {
          const isToday   = date ? sameDay(date, today) : false;
          const dayEvents = date ? eventsForDay(date) : [];
          return (
            <div
              key={idx}
              onClick={() => date && onDayClick(date)}
              className="border-b border-r p-1 min-h-[80px] relative transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                background:  date ? (isToday ? 'var(--color-accent-subtle)' : 'var(--color-white)') : 'var(--color-surface)',
                cursor:      date ? 'pointer' : 'default',
              }}
            >
              {date && (
                <>
                  <span
                    className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1"
                    style={{
                      background: isToday ? 'var(--color-accent)'      : 'transparent',
                      color:      isToday ? 'white' : 'var(--color-text-secondary)',
                    }}
                  >
                    {date.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <EventPill key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-xs px-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void }) {
  if (events.length === 0) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No events in this period</p>
    </div>
  );

  // Group by date
  const grouped: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    const key = new Date(ev.startAt).toDateString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  return (
    <div className="flex-1 overflow-y-auto space-y-1 p-1">
      {Object.entries(grouped).map(([date, evs]) => (
        <div key={date}>
          <p className="text-xs font-semibold px-2 py-1.5 sticky top-0" style={{ background: 'var(--color-canvas)', color: 'var(--color-text-tertiary)' }}>
            {new Date(date).toLocaleDateString('en-PK', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {evs.map((ev) => {
            const color = ev.color ?? 'var(--color-accent)';
            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-[--color-surface] group"
              >
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{ev.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Clock className="w-3 h-3" />
                      {ev.allDay ? 'All day' : `${fmtTime(ev.startAt)} – ${fmtTime(ev.endAt)}`}
                    </span>
                    {ev.location && (
                      <span className="text-xs flex items-center gap-1 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                        <MapPin className="w-3 h-3" />{ev.location}
                      </span>
                    )}
                    <StatusBadge label={ev.status} variant={EVENT_STATUS_BADGE[ev.status] ?? 'default'} />
                    {ev.attendees?.length > 0 && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        <Users className="w-3 h-3" />{ev.attendees.length}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'list';

export default function CalendarPage() {
  const params  = useParams<{ orgId: string }>();
  const orgId   = params.orgId;
  const today   = new Date();

  const [viewMode,    setViewMode]    = useState<ViewMode>('month');
  const [current,     setCurrent]     = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [modalState,  setModalState]  = useState<{
    open: boolean; event?: Partial<CalendarEvent>; date?: Date;
  }>({ open: false });

  // Build query for current month/period
  const query = useMemo(() => {
    const from = new Date(current.getFullYear(), current.getMonth(), 1);
    const to   = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [current]);

  const { events, loading, refetch, setEvents } = useCalendarEvents(orgId, query);

  const navigate = (dir: -1 | 1) => setCurrent((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  const goToday  = () => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1));

  const openNew   = (date?: Date) => setModalState({ open: true, date: date ?? new Date() });
  const openEdit  = (event: CalendarEvent) => setModalState({ open: true, event });
  const closeModal = () => setModalState({ open: false });

  const handleSave = useCallback(async (data: Partial<CalendarEvent>) => {
    try {
      if (modalState.event?.id) {
        const updated = await calendarApi.updateEvent(orgId, modalState.event.id, data);
        setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
        toast.success('Event updated');
      } else {
        const created = await calendarApi.createEvent(orgId, data);
        setEvents((prev) => [...prev, created]);
        toast.success('Event created');
      }
    } catch { toast.error('Failed to save event'); throw new Error(); }
  }, [orgId, modalState.event?.id, setEvents]);

  const handleDelete = useCallback(async () => {
    if (!modalState.event?.id) return;
    await calendarApi.deleteEvent(orgId, modalState.event.id);
    setEvents((prev) => prev.filter((e) => e.id !== modalState.event?.id));
    toast.success('Event deleted');
  }, [orgId, modalState.event?.id, setEvents]);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-height)-4rem)]">
      <PageHeader
        title="Calendar"
        actions={
          <Btn icon={<Plus className="w-4 h-4" />} onClick={() => openNew()}>
            New Event
          </Btn>
        }
      />

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Nav */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-[--color-surface] transition-colors" style={{ color: 'var(--color-text-tertiary)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="px-3 h-8 rounded-lg text-sm font-medium hover:bg-[--color-surface] transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
            Today
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-[--color-surface] transition-colors" style={{ color: 'var(--color-text-tertiary)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month / Year label */}
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {MONTHS[current.getMonth()]} {current.getFullYear()}
        </h2>

        {/* View toggle */}
        <div className="ml-auto flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {([['month', <Grid3X3 key="g" className="w-4 h-4" />], ['list', <List key="l" className="w-4 h-4" />]] as const).map(([mode, icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as ViewMode)}
              className="p-2 transition-colors"
              style={{
                background: viewMode === mode ? 'var(--color-surface-2)' : 'var(--color-white)',
                color:      viewMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
              aria-label={`${mode} view`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 rounded-xl border overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-white)' }}
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm animate-pulse" style={{ color: 'var(--color-text-tertiary)' }}>Loading events…</p>
          </div>
        ) : viewMode === 'month' ? (
          <MonthView
            year={current.getFullYear()}
            month={current.getMonth()}
            events={events}
            today={today}
            onDayClick={openNew}
            onEventClick={openEdit}
          />
        ) : (
          <ListView events={events} onEventClick={openEdit} />
        )}
      </div>

      {/* ── Event modal ──────────────────────────────────────────────── */}
      {modalState.open && (
        <EventModal
          event={modalState.event}
          date={modalState.date}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={modalState.event?.id ? handleDelete : undefined}
          orgId={orgId}
        />
      )}
    </div>
  );
}