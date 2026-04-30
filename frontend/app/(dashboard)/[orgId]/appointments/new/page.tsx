'use client';
// /app/(dashboard)/[orgId]/appointments/new/page.tsx
import { useState, useCallback }   from 'react';
import { useParams, useRouter }    from 'next/navigation';
import { toast }                   from 'sonner';
import { Clock, MapPin, Link2, FileText, User } from 'lucide-react';
import { appointmentsApi }         from '../../../../../lib/appointments-api';
import { PageHeader }              from '../../../../../components/shared/PageHeader';
import { Btn }                     from '../../../../../components/shared/index';

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</p>}
    </div>
  );
}

export default function NewAppointmentPage() {
  const params  = useParams<{ orgId: string }>();
  const router  = useRouter();
  const [saving, setSaving] = useState(false);

  // Default to next hour
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:00`;

  const [form, setForm] = useState({
    title:           '',
    scheduledAt:     toLocal(nextHour),
    durationMinutes: '30',
    notes:           '',
    location:        '',
    meetingUrl:      '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const inputCls = "w-full h-9 px-3 text-sm rounded-lg border";
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'var(--color-white)' };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim())     { toast.error('Title is required'); return; }
    if (!form.scheduledAt)      { toast.error('Date and time is required'); return; }

    setSaving(true);
    try {
      const apt = await appointmentsApi.create(params.orgId, {
        title:           form.title,
        scheduledAt:     new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        notes:           form.notes || undefined,
        location:        form.location || undefined,
        meetingUrl:      form.meetingUrl || undefined,
      });
      toast.success('Appointment created');
      router.push(`/${params.orgId}/appointments/${apt.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create appointment');
      setSaving(false);
    }
  }, [form, params.orgId, router]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <PageHeader
        title="New Appointment"
        breadcrumbs={[
          { label: 'Appointments', href: `/${params.orgId}/appointments` },
          { label: 'New' },
        ]}
        actions={
          <div className="flex gap-2">
            <Btn type="button" variant="outline" onClick={() => router.back()}>Cancel</Btn>
            <Btn type="submit" loading={saving}>Save</Btn>
          </div>
        }
      />

      <div className="card space-y-4">
        <FormField label="Title *">
          <input
            type="text"
            placeholder="e.g. Onboarding Call with Client"
            value={form.title}
            onChange={set('title')}
            autoFocus
            className={inputCls}
            style={inputStyle}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date & Time *">
            <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className={inputCls} style={inputStyle} />
          </FormField>
          <FormField label="Duration" hint="In minutes">
            <select value={form.durationMinutes} onChange={set('durationMinutes')} className={inputCls} style={inputStyle}>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Location (optional)">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
            <input type="text" placeholder="Office, address, or room" value={form.location} onChange={set('location')} className={`${inputCls} pl-9`} style={inputStyle} />
          </div>
        </FormField>

        <FormField label="Meeting URL (optional)" hint="Zoom, Google Meet, Teams link">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
            <input type="url" placeholder="https://meet.google.com/…" value={form.meetingUrl} onChange={set('meetingUrl')} className={`${inputCls} pl-9`} style={inputStyle} />
          </div>
        </FormField>

        <FormField label="Notes (optional)">
          <textarea
            rows={3}
            placeholder="Agenda, preparation notes…"
            value={form.notes}
            onChange={set('notes')}
            className="w-full px-3 py-2 text-sm rounded-lg border resize-none"
            style={inputStyle}
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-2 pb-8">
        <Btn type="button" variant="outline" onClick={() => router.back()}>Cancel</Btn>
        <Btn type="submit" loading={saving}>Save Appointment</Btn>
      </div>
    </form>
  );
}