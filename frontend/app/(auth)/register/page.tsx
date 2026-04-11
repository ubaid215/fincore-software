'use client';
// src/app/(auth)/register/page.tsx

import { useState, useCallback } from 'react';
import Link                      from 'next/link';
import { toast }                 from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth }               from '../../../hooks/useAuth';
import {
  AuthCard, Field, AuthButton, AuthDivider, AuthInput,
} from '../../../components/auth/AuthCard';
import { authApi }               from '../../../lib/auth-api';

// Password strength helper
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)                        score++;
  if (/[A-Z]/.test(pw))                      score++;
  if (/[a-z]/.test(pw))                      score++;
  if (/\d/.test(pw))                         score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;

  const map = [
    { label: '',          color: 'transparent' },
    { label: 'Too weak',  color: 'var(--color-danger)' },
    { label: 'Weak',      color: '#f97316' },
    { label: 'Fair',      color: 'var(--color-warning)' },
    { label: 'Good',      color: '#84cc16' },
    { label: 'Strong',    color: 'var(--color-success)' },
  ];
  return { score, ...map[Math.min(score, 5)] };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [submitted,    setSubmitted]    = useState(false);
  const [userId,       setUserId]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const strength = getPasswordStrength(form.password);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required';
    if (!form.email.trim())     errs.email     = 'Email is required';
    if (!form.password)         errs.password  = 'Password is required';
    if (form.password && strength.score < 3) errs.password = 'Password is too weak';
    return errs;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const result = await register({
        email:     form.email.trim().toLowerCase(),
        password:  form.password,
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        phone:     form.phone.trim() || undefined,
      });
      setUserId(result.userId);
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Registration failed. Please try again.';
      if (msg.toLowerCase().includes('already')) {
        setErrors({ email: 'An account with this email already exists' });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [form, register]);

  const handleResend = async () => {
    try {
      await authApi.resendVerification();
      toast.success('Verification email resent!');
    } catch {
      toast.error('Could not resend. Please try again.');
    }
  };

  if (submitted) {
    return (
      <AuthCard
        title="Check your inbox"
        description={`We sent a verification link to ${form.email}`}
        footer={
          <p>
            Already verified?{' '}
            <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
              Sign in
            </Link>
          </p>
        }
      >
        <div className="space-y-5 py-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'var(--color-success-subtle)' }}
          >
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="space-y-2 text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
            <p>Click the link in your email to verify your account.</p>
            <p style={{ color: 'var(--color-text-tertiary)' }}>Link expires in 24 hours.</p>
          </div>
          <AuthButton variant="outline" onClick={handleResend}>
            <Mail className="w-4 h-4" />
            Resend verification email
          </AuthButton>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Free forever on one app. No credit card required."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" htmlFor="firstName" error={errors.firstName}>
            <AuthInput
              id="firstName"
              type="text"
              placeholder="John"
              autoComplete="given-name"
              autoFocus
              value={form.firstName}
              onChange={set('firstName')}
              error={!!errors.firstName}
              leftIcon={<User className="w-4 h-4" />}
            />
          </Field>
          <Field label="Last Name" htmlFor="lastName" error={errors.lastName}>
            <AuthInput
              id="lastName"
              type="text"
              placeholder="Doe"
              autoComplete="family-name"
              value={form.lastName}
              onChange={set('lastName')}
              error={!!errors.lastName}
            />
          </Field>
        </div>

        <Field label="Work Email" htmlFor="reg-email" error={errors.email}>
          <AuthInput
            id="reg-email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            error={!!errors.email}
            leftIcon={<Mail className="w-4 h-4" />}
          />
        </Field>

        <Field label="Password" htmlFor="reg-password" error={errors.password}>
          <AuthInput
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min 8 chars, one uppercase, one number"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={!!errors.password}
            leftIcon={<Lock className="w-4 h-4" />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ color: 'var(--color-text-tertiary)' }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          {/* Strength indicator */}
          {form.password.length > 0 && (
            <div className="mt-1.5 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background: i <= strength.score ? strength.color : 'var(--color-surface-2)',
                    }}
                  />
                ))}
              </div>
              {strength.label && (
                <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
              )}
            </div>
          )}
        </Field>

        <Field label="Phone (optional)" htmlFor="phone" hint="Used for 2FA and account recovery">
          <AuthInput
            id="phone"
            type="tel"
            placeholder="+92 300 1234567"
            autoComplete="tel"
            value={form.phone}
            onChange={set('phone')}
            leftIcon={<Phone className="w-4 h-4" />}
          />
        </Field>

        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="underline hover:no-underline" style={{ color: 'var(--color-accent)' }}>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:no-underline" style={{ color: 'var(--color-accent)' }}>
            Privacy Policy
          </Link>.
        </p>

        <AuthButton type="submit" loading={isLoading}>
          Create account
          <ArrowRight className="w-4 h-4" />
        </AuthButton>

        <AuthDivider text="or" />

        <AuthButton
          type="button"
          variant="outline"
          onClick={() => { window.location.href = authApi.getGoogleAuthUrl(); }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign up with Google
        </AuthButton>
      </form>
    </AuthCard>
  );
}