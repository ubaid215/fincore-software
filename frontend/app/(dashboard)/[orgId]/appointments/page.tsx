'use client';
// /app/(dashboard)/[orgId]/appointments/page.tsx
import { useState, useCallback }   from 'react';
import { useParams }               from 'next/navigation';
import Link                        from 'next/link';
import { CalendarClock, Plus, Clock, MapPin, Link2, User } from 'lucide-react';
import { useAppointments }         from '../../../../hooks/useCalendar';
import { PageHeader }              from '../../../../components/shared/PageHeader';
import {
  StatusBadge, EmptyState, Btn, SearchInput, Skeleton,
  Avatar, APT_STATUS_BADGE,
} from '../../../../components/shared/index';
import type { Appointment, AppointmentStatus } from '../../../../types/api';

const STATUS_OPTIONS: { value: AppointmentStatus | ''; label: string }[] = [
  { value: '',           label: 'All statuses' },
  { value: 'SCHEDULED',  label: 'Scheduled' },
  { value: 'CONFIRMED',  label: 'Confirmed' },
  { value: 'COMPLETED',  label: 'Completed' },
  { value: 'NO_SHOW',    label: 'No Show' },
  { value: 'CANCELLED',  label: 'Cancelled' },
];

function AptCard({ apt, orgId }: { apt: Appointment; orgId: string }) {
  const scheduledAt = new Date(apt.scheduledAt);
  const isUpcoming  = scheduledAt > new Date();

  return (
    <Link
      href={`/${orgId}/appointments/${apt.id}`}
      className="card hover:shadow-md transition-all duration-200 active:scale-[0.99] block"
    >
      <div className="flex items-start gap-3">
        {/* Date block */}
        <div
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 text-white"
          style={{ background: isUpcoming ? 'var(--color-accent)' : 'var(--color-text-disabled)' }}
        >
          <span className="text-xs font-semibold leading-none">
            {scheduledAt.toLocaleDateString('en-PK', { month: 'short' }).toUpperCase()}
          </span>
          <span className="text-xl font-bold leading-none mt-0.5">{scheduledAt.getDate()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{apt.title}</p>
              {apt.contact && (
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <User className="w-3 h-3" />{apt.contact.displayName}
                </p>
              )}
            </div>
            <StatusBadge label={apt.status} variant={APT_STATUS_BADGE[apt.status] ?? 'default'} />
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <Clock className="w-3 h-3" />
              {scheduledAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
              {' · '}{apt.durationMinutes} min
            </span>
            {apt.location && (
              <span className="text-xs flex items-center gap-1 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                <MapPin className="w-3 h-3" />{apt.location}
              </span>
            )}
            {apt.meetingUrl && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                <Link2 className="w-3 h-3" />Online
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function AppointmentsPage() {
  const params  = useParams<{ orgId: string }>();
  const orgId   = params.orgId;
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [search, setSearch] = useState('');

  const { data, loading, refetch } = useAppointments(orgId, {
    status: status || undefined,
    limit:  50,
  });

  const apts = (data?.data ?? []).filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
               a.contact?.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Schedule and manage client meetings"
        actions={
          <Link href={`/${orgId}/appointments/new`}>
            <Btn icon={<Plus className="w-4 h-4" />}>New Appointment</Btn>
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search appointments…" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AppointmentStatus | '')}
          className="h-9 pl-3 pr-8 text-sm rounded-lg border sm:ml-auto"
          style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : apts.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-7 h-7" />}
          title="No appointments"
          description="Schedule your first client appointment."
          action={{ label: 'New Appointment', href: `/${orgId}/appointments/new` }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apts.map((a) => <AptCard key={a.id} apt={a} orgId={orgId} />)}
        </div>
      )}
    </div>
  );
}