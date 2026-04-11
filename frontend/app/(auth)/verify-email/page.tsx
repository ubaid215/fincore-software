'use client';
// src/app/(auth)/verify-email/page.tsx
import { useEffect, useState } from 'react';
import { useSearchParams }     from 'next/navigation';
import Link                    from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth }             from '../../../hooks/useAuth';
import { AuthCard, AuthButton } from '../../../components/auth/AuthCard';

export default function VerifyEmailPage() {
  const params  = useSearchParams();
  const token   = params.get('token');
  const { verifyEmail } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Invalid verification link'); return; }
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.response?.data?.message ?? 'Verification failed. Link may have expired.');
      });
  }, [token]);

  return (
    <AuthCard title="Email Verification">
      <div className="space-y-5 py-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--color-success-subtle)' }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Email verified! Redirecting you to your dashboard…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--color-danger-subtle)' }}>
              <XCircle className="w-7 h-7" style={{ color: 'var(--color-danger)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-danger-text)' }}>{message}</p>
            <AuthButton variant="outline" fullWidth={false}>
              <Link href="/login">Back to login</Link>
            </AuthButton>
          </>
        )}
      </div>
    </AuthCard>
  );
}