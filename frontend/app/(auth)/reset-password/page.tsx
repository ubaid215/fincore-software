'use client';
// src/app/(auth)/reset-password/page.tsx
import { useState, useEffect } from 'react';
import { useSearchParams }     from 'next/navigation';
import { useRouter }           from 'next/navigation';
import { toast }               from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { authApi }             from '../../../lib/auth-api';
import { AuthCard, Field, AuthButton, AuthInput } from '../../../components/auth/AuthCard';
import Link from 'next/link';

function getStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++; if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++;
  return s;
}

export default function ResetPasswordPage() {
  const params   = useSearchParams();
  const router   = useRouter();
  const token    = params.get('token') ?? '';

  const [form, setForm]             = useState({ password: '', confirm: '' });
  const [showPw, setShowPw]         = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [done, setDone]             = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  if (!token) return (
    <AuthCard title="Invalid link">
      <div className="text-center py-4 space-y-3">
        <XCircle className="w-10 h-10 mx-auto" style={{ color: 'var(--color-danger)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>Request a new link</Link>
      </div>
    </AuthCard>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.password)                   errs.password = 'Required';
    if (getStrength(form.password) < 3)   errs.password = 'Password is too weak';
    if (form.password !== form.confirm)   errs.confirm  = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, form.password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reset password. Link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (done) return (
    <AuthCard title="Password updated!">
      <div className="text-center py-4 space-y-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--color-success-subtle)' }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>All sessions have been revoked. Redirecting to login…</p>
      </div>
    </AuthCard>
  );

  const strength = getStrength(form.password);
  const colors   = ['transparent', 'var(--color-danger)', '#f97316', 'var(--color-warning)', '#84cc16', 'var(--color-success)'];

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password for your account."
      footer={<Link href="/login" className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>← Back to login</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="New Password" htmlFor="np" error={errors.password}>
          <AuthInput
            id="np" type={showPw ? 'text' : 'password'}
            placeholder="Min 8 chars, one uppercase, one number"
            autoComplete="new-password" autoFocus
            value={form.password}
            onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setErrors({}); }}
            error={!!errors.password}
            leftIcon={<Lock className="w-4 h-4" />}
            rightElement={
              <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1} style={{ color: 'var(--color-text-tertiary)' }}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          {form.password.length > 0 && (
            <div className="mt-1.5 flex gap-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i <= strength ? colors[Math.min(strength, 5)] : 'var(--color-surface-2)' }} />
              ))}
            </div>
          )}
        </Field>

        <Field label="Confirm Password" htmlFor="cp" error={errors.confirm}>
          <AuthInput
            id="cp" type="password" placeholder="••••••••"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => { setForm((f) => ({ ...f, confirm: e.target.value })); setErrors({}); }}
            error={!!errors.confirm}
            leftIcon={<Lock className="w-4 h-4" />}
          />
        </Field>

        <AuthButton type="submit" loading={isLoading}>
          Update password
        </AuthButton>
      </form>
    </AuthCard>
  );
}