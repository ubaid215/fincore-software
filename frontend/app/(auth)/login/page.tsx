'use client';
// src/app/(auth)/login/page.tsx

import { useState, useCallback } from 'react';
import Link                      from 'next/link';
import { toast }                 from 'sonner';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth }               from '../../../hooks/useAuth';
import { authApi }               from '../../../lib/auth-api';
import { isMfaRequired }         from '../../../types/auth';
import {
  AuthCard, Field, AuthButton, AuthDivider, AuthInput,
} from '../../../components/auth/AuthCard';

type Step = 'credentials' | 'mfa' | 'magic-sent';

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();

  const [step,         setStep]        = useState<Step>('credentials');
  const [mfaUserId,    setMfaUserId]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]   = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const [form, setForm] = useState({ email: '', password: '', mfaCode: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  // ── Email + Password submit ────────────────────────────────────────────────

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.email)    errs.email    = 'Email is required';
    if (!form.password) errs.password = 'Password is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const result = await login({
        email:       form.email.trim().toLowerCase(),
        password:    form.password,
        deviceLabel: navigator.userAgent.slice(0, 80),
      });
      console.log('login result:', result); 

      if (isMfaRequired(result)) {
  if (process.env.NEXT_PUBLIC_SKIP_MFA === 'true') return;
  setMfaUserId(result.userId);
  setStep('mfa');
}
      // If not MFA, useAuth handles redirect internally
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Invalid email or password';
      if (msg.toLowerCase().includes('locked')) {
        toast.error(msg, { duration: 8000 });
      } else if (msg.toLowerCase().includes('verify')) {
        toast.warning('Please verify your email first. Check your inbox.', {
          action: { label: 'Resend', onClick: handleResendVerification },
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [form, login]);

  // ── MFA submit ────────────────────────────────────────────────────────────

  const handleMfa = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.mfaCode.length !== 6) {
      setErrors({ mfaCode: 'Enter the 6-digit code from your authenticator app' });
      return;
    }
    setIsLoading(true);
    try {
      await verifyMfa(mfaUserId, form.mfaCode, navigator.userAgent.slice(0, 80));
    } catch (err: any) {
      setErrors({ mfaCode: 'Invalid code. Try again.' });
      toast.error('Invalid 2FA code');
    } finally {
      setIsLoading(false);
    }
  }, [form.mfaCode, mfaUserId, verifyMfa]);

  // ── Magic link ────────────────────────────────────────────────────────────

  const handleMagicLink = useCallback(async () => {
    if (!form.email.trim()) {
      setErrors({ email: 'Enter your email address first' });
      return;
    }
    setMagicLoading(true);
    try {
      await authApi.sendMagicLink(form.email.trim().toLowerCase());
      setStep('magic-sent');
    } catch {
      toast.error('Could not send magic link. Try again.');
    } finally {
      setMagicLoading(false);
    }
  }, [form.email]);

  // ── Resend verification ───────────────────────────────────────────────────

  const handleResendVerification = async () => {
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent!');
    } catch {
      toast.error('Could not resend. Please try again.');
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const handleGoogle = () => {
    window.location.href = authApi.getGoogleAuthUrl();
  };

  // ── Renders ───────────────────────────────────────────────────────────────

  if (step === 'magic-sent') {
    return (
      <AuthCard
        title="Check your email"
        description={`We sent a sign-in link to ${form.email}`}
        footer={
          <button
            className="text-sm font-medium hover:underline transition-all"
            style={{ color: 'var(--color-accent)' }}
            onClick={() => setStep('credentials')}
          >
            ← Back to login
          </button>
        }
      >
        <div className="space-y-4 py-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'var(--color-accent-subtle)' }}
          >
            <Mail className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
            The link expires in 15 minutes. Click it on any device to sign in.
          </p>
          <AuthButton
            variant="outline"
            onClick={handleMagicLink}
            loading={magicLoading}
          >
            Resend link
          </AuthButton>
        </div>
      </AuthCard>
    );
  }

  if (step === 'mfa') {
    return (
      <AuthCard
        title="Two-factor verification"
        description="Enter the 6-digit code from your authenticator app."
        footer={
          <button
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-accent)' }}
            onClick={() => setStep('credentials')}
          >
            ← Back to login
          </button>
        }
      >
        <form onSubmit={handleMfa} className="space-y-4">
          <Field label="Authentication Code" htmlFor="mfaCode" error={errors.mfaCode}>
            <AuthInput
              id="mfaCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
              value={form.mfaCode}
              onChange={set('mfaCode')}
              error={!!errors.mfaCode}
              className="text-center text-xl font-mono tracking-[0.5em]"
            />
          </Field>
          <AuthButton type="submit" loading={isLoading}>
            Verify
          </AuthButton>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your FinCore account."
      footer={
        <p>
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Create one free
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        {/* Google OAuth */}
        <AuthButton variant="outline" type="button" onClick={handleGoogle}>
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </AuthButton>

        <AuthDivider text="or continue with email" />

        {/* Email + password form */}
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <Field label="Work Email" htmlFor="email" error={errors.email}>
            <AuthInput
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
              value={form.email}
              onChange={set('email')}
              error={!!errors.email}
              leftIcon={<Mail className="w-4 h-4" />}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password}>
            <AuthInput
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
              error={!!errors.password}
              leftIcon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-0.5 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </Field>

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Forgot password?
            </Link>
          </div>

          <AuthButton type="submit" loading={isLoading}>
            Sign in
            <ArrowRight className="w-4 h-4" />
          </AuthButton>
        </form>

        <AuthDivider text="passwordless" />

        {/* Magic link */}
        <AuthButton
          type="button"
          variant="outline"
          loading={magicLoading}
          onClick={handleMagicLink}
        >
          <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          Send magic link
        </AuthButton>
      </div>
    </AuthCard>
  );
}