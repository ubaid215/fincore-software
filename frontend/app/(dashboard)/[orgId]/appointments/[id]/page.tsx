'use client';
// /app/(dashboard)/[orgId]/appointments/[id]/page.tsx
import { useCallback }             from 'react';
import { useParams, useRouter }    from 'next/navigation';
import Link                        from 'next/link';
import { toast }                   from 'sonner';
import {
  Clock, MapPin, Link2, User, CheckCircle2,
  XCircle, AlertCircle, Pencil, ExternalLink,
} from 'lucide-react';
import { useAppointment }          from '../../../../../hooks/useCalendar';
import { appointmentsApi }         from '../../../../../lib/appointments-api';
import { PageHeader }              from '../../../../../components/shared/PageHeader';
import { Btn, StatusBadge, Skeleton, EmptyState, APT_STATUS_BADGE } from '../../../../../components/shared/index';
import type { AppointmentStatus }  from '../../../../../types/api';

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <div>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        {href
          ? <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
              {value} <ExternalLink className="w-3 h-3" />
            </a>
          : <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        }
      </div>
    </div>
  );
}

interface StatusAction { label: string; status: AppointmentStatus; variant: 'primary' | 'outline' | 'danger'; icon: React.ReactNode }

const STATUS_ACTIONS: Partial<Record<AppointmentStatus, StatusAction[]>> = {
  SCHEDULED: [
    { label: 'Confirm',  status: 'CONFIRMED', variant: 'primary', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Cancel',   status: 'CANCELLED', variant: 'danger',  icon: <XCircle className="w-4 h-4" /> },
  ],
  CONFIRMED: [
    { label: 'Mark Completed', status: 'COMPLETED', variant: 'primary', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'No Show',        status: 'NO_SHOW',   variant: 'outline', icon: <AlertCircle className="w-4 h-4" /> },
    { label: 'Cancel',         status: 'CANCELLED', variant: 'danger',  icon: <XCircle className="w-4 h-4" /> },
  ],
};

export default function AppointmentDetailPage() {
  const params  = useParams<{ orgId: string; id: string }>();
  const router  = useRouter();
  const { appointment: apt, loading, refetch, setAppointment } = useAppointment(params.orgId, params.id);

  const handleAction = useCallback(async (status: AppointmentStatus) => {
    try {
      let updated;
      if (status === 'CONFIRMED')  updated = await appointmentsApi.confirm(params.orgId, params.id);
      else if (status === 'COMPLETED') updated = await appointmentsApi.complete(params.orgId, params.id);
      else if (status === 'NO_SHOW')   updated = await appointmentsApi.noShow(params.orgId, params.id);
      else if (status === 'CANCELLED') {
        const reason = prompt('Cancellation reason (optional):') ?? undefined;
        updated = await appointmentsApi.cancel(params.orgId, params.id, reason);
      }
      if (updated) { setAppointment(updated); toast.success(`Status updated to ${status}`); }
    } catch { toast.error('Failed to update status'); }
  }, [params]);

  if (loading) return (
    <div className="space-y-4 max-w-2xl">
      <div className="card space-y-4">
        <Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-1/3" />
      </div>
      <div className="card space-y-3">{Array.from({length: 4}).map((_,i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
    </div>
  );

  if (!apt) return (
    <EmptyState icon={<Clock className="w-7 h-7" />} title="Appointment not found"
      action={{ label: 'Back to Appointments', href: `/${params.orgId}/appointments` }} />
  );

  const scheduledAt = new Date(apt.scheduledAt);
  const actions     = STATUS_ACTIONS[apt.status] ?? [];

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title={apt.title}
        breadcrumbs={[
          { label: 'Appointments', href: `/${params.orgId}/appointments` },
          { label: apt.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge label={apt.status} variant={APT_STATUS_BADGE[apt.status] ?? 'default'} />
          </div>
        }
      />

      {/* Status actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Btn
              key={action.status}
              variant={action.variant}
              size="sm"
              icon={action.icon}
              onClick={() => handleAction(action.status)}
            >
              {action.label}
            </Btn>
          ))}
        </div>
      )}

      {/* Detail card */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Appointment Details</h3>
        <div>
          <InfoRow
            icon={<Clock className="w-4 h-4" />}
            label="Date & Time"
            value={`${scheduledAt.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${scheduledAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })} · ${apt.durationMinutes} minutes`}
          />
          <InfoRow icon={<MapPin className="w-4 h-4" />}    label="Location"    value={apt.location} />
          <InfoRow icon={<Link2 className="w-4 h-4" />}     label="Meeting URL" value={apt.meetingUrl} href={apt.meetingUrl ?? undefined} />
          <InfoRow icon={<User className="w-4 h-4" />}      label="Contact"     value={apt.contact?.displayName}
            href={apt.contactId ? `/${params.orgId}/contacts/${apt.contactId}` : undefined} />
        </div>
      </div>

      {/* Notes */}
      {apt.notes && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Notes</h3>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{apt.notes}</p>
        </div>
      )}

      {/* Cancellation info */}
      {apt.cancelReason && (
        <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-subtle)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-danger-text)' }}>Cancelled</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-danger-text)' }}>{apt.cancelReason}</p>
        </div>
      )}
    </div>
  );
}