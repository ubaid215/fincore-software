'use client';
// src/app/(auth)/onboarding/page.tsx
import { useState }          from 'react';
import { useRouter }         from 'next/navigation';
import { toast }             from 'sonner';
import { Building2, Globe, DollarSign, Calendar, Hash, Briefcase } from 'lucide-react';
import { useAuth }           from '../../../hooks/useAuth';
import { Field, AuthButton, AuthInput } from '../../../components/auth/AuthCard';
import type { BusinessType, AppKey, OnboardOrgPayload } from '../../../types/auth';

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'SME',         label: 'SME' },
  { value: 'FREELANCER',  label: 'Freelancer' },
  { value: 'STARTUP',     label: 'Startup' },
  { value: 'CORPORATION', label: 'Corporation' },
  { value: 'NON_PROFIT',  label: 'Non-Profit' },
  { value: 'ENTERPRISE',  label: 'Enterprise' },
];

const APPS: { value: AppKey; label: string; description: string }[] = [
  { value: 'INVOICING',     label: 'Invoicing',     description: 'Send invoices, track payments' },
  { value: 'EXPENSES',      label: 'Expenses',       description: 'Track and approve expenses' },
  { value: 'CONTACTS',      label: 'Contacts',       description: 'Manage clients & vendors' },
  { value: 'CALENDAR',      label: 'Calendar',       description: 'Schedule events & meetings' },
  { value: 'DOCUMENTS',     label: 'Documents',      description: 'Store and share documents' },
];

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export default function OnboardingPage() {
  const { onboardOrg }  = useAuth();
  const router          = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const [form, setForm] = useState<OnboardOrgPayload>({
    businessName:    '',
    businessType:    'SME',
    country:         'PK',
    currency:        'PKR',
    fiscalYearStart: 1,
    timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone,
    taxId:           '',
    industry:        '',
    selectedApp:     'INVOICING',
  });

  const set = (key: keyof OnboardOrgPayload) => (val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.businessName.trim()) e.businessName = 'Business name is required';
    if (!form.country.trim())      e.country      = 'Country is required';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const orgId = await onboardOrg({
        ...form,
        taxId:   form.taxId?.trim()   || undefined,
        industry: form.industry?.trim() || undefined,
      });
      router.push(`/${orgId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-canvas)' }}>
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            Step 2 of 2
          </p>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.025em' }}>
            Set up your organization
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            This creates your tenant workspace. You can always change these settings later.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--color-accent)' }} />
          <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--color-accent)' }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Card */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Business Details
            </h2>

            <Field label="Business / Organization Name" htmlFor="bname" error={errors.businessName}>
              <AuthInput
                id="bname" type="text" placeholder="Acme Corp"
                autoComplete="organization" autoFocus
                value={form.businessName}
                onChange={(e) => { set('businessName')(e.target.value); setErrors({}); }}
                error={!!errors.businessName}
                leftIcon={<Building2 className="w-4 h-4" />}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Business Type" htmlFor="btype">
                <select
                  id="btype"
                  className="w-full h-10 px-3 rounded-lg border text-sm"
                  style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  value={form.businessType}
                  onChange={(e) => set('businessType')(e.target.value as BusinessType)}
                >
                  {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <Field label="Country" htmlFor="country" error={errors.country}>
                <AuthInput
                  id="country" type="text" placeholder="PK"
                  maxLength={2}
                  value={form.country}
                  onChange={(e) => { set('country')(e.target.value.toUpperCase()); setErrors({}); }}
                  error={!!errors.country}
                  leftIcon={<Globe className="w-4 h-4" />}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Default Currency" htmlFor="currency">
                <select
                  id="currency"
                  className="w-full h-10 px-3 rounded-lg border text-sm"
                  style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  value={form.currency}
                  onChange={(e) => set('currency')(e.target.value)}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Fiscal Year Start" htmlFor="fy">
                <select
                  id="fy"
                  className="w-full h-10 px-3 rounded-lg border text-sm"
                  style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  value={form.fiscalYearStart}
                  onChange={(e) => set('fiscalYearStart')(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="NTN / Tax ID (optional)" htmlFor="taxid" hint="e.g. 1234567-8">
                <AuthInput
                  id="taxid" type="text" placeholder="1234567-8"
                  value={form.taxId ?? ''}
                  onChange={(e) => set('taxId')(e.target.value)}
                  leftIcon={<Hash className="w-4 h-4" />}
                />
              </Field>
              <Field label="Industry (optional)" htmlFor="industry">
                <AuthInput
                  id="industry" type="text" placeholder="Technology"
                  value={form.industry ?? ''}
                  onChange={(e) => set('industry')(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4" />}
                />
              </Field>
            </div>
          </div>

          {/* App selection */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Choose your first app
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                Free plan includes 1 app. Upgrade anytime to unlock all apps.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {APPS.map((app) => {
                const selected = form.selectedApp === app.value;
                return (
                  <button
                    key={app.value}
                    type="button"
                    onClick={() => set('selectedApp')(app.value)}
                    className="flex flex-col items-start gap-0.5 p-3 rounded-lg border text-left transition-all"
                    style={{
                      background:   selected ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
                      borderColor:  selected ? 'var(--color-accent)' : 'var(--color-border)',
                      boxShadow:    selected ? '0 0 0 2px rgba(42,125,111,0.15)' : undefined,
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: selected ? 'var(--color-accent-text)' : 'var(--color-text-primary)' }}>
                      {app.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {app.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <AuthButton type="submit" loading={isLoading}>
            Create organization & go to dashboard
          </AuthButton>
        </form>
      </div>
    </div>
  );
}