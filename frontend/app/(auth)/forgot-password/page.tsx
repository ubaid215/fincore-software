'use client';
// src/app/(auth)/forgot-password/page.tsx
import { useState }  from 'react';
import Link          from 'next/link';
import { toast }     from 'sonner';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authApi }   from '../../../lib/auth-api';
import { AuthCard, Field, AuthButton, AuthInput } from '../../../components/auth/AuthCard';

export default function ForgotPasswordPage() {
  const [email,    setEmail]    = useState('');
  const [sent,     setSent]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description={`If an account exists for ${email}, you'll receive a reset link.`}
        footer={<Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>← Back to login</Link>}
      >
        <div className="py-4 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-success-subtle)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
            The link expires in 60 minutes. Check your spam folder if you don&apos;t see it.
          </p>
          <AuthButton variant="outline" onClick={handleSubmit} loading={isLoading}>
            Resend email
          </AuthButton>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email address and we'll send you a reset link."
      footer={<Link href="/login" className="font-medium hover:underline text-sm" style={{ color: 'var(--color-accent)' }}><span className="flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Back to login</span></Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Work Email" htmlFor="fp-email" error={error}>
          <AuthInput
            id="fp-email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            error={!!error}
            leftIcon={<Mail className="w-4 h-4" />}
          />
        </Field>
        <AuthButton type="submit" loading={isLoading}>
          Send reset link
        </AuthButton>
      </form>
    </AuthCard>
  );
}