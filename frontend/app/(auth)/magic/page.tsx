'use client';
// src/app/(auth)/magic/page.tsx
import { useEffect, useState } from 'react';
import { useSearchParams }     from 'next/navigation';
import { Loader2, XCircle }    from 'lucide-react';
import Link                    from 'next/link';
import { useAuth }             from '../../../hooks/useAuth';
import { AuthCard, AuthButton } from '../../../components/auth/AuthCard';

export default function MagicPage() {
  const params  = useSearchParams();
  const token   = params.get('token');
  const { verifyMagicLink } = useAuth();
  const [status, setStatus]   = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Invalid magic link'); return; }
    verifyMagicLink(token).catch((err: any) => {
      setStatus('error');
      setMessage(err?.response?.data?.message ?? 'This link is invalid or has expired.');
    });
  }, [token]);

  return (
    <AuthCard title="Signing you in…">
      <div className="py-6 text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Verifying your magic link…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--color-danger-subtle)' }}>
              <XCircle className="w-7 h-7" style={{ color: 'var(--color-danger)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-danger-text)' }}>{message}</p>
            <AuthButton variant="outline" fullWidth={false}>
              <Link href="/login">Request a new link</Link>
            </AuthButton>
          </>
        )}
      </div>
    </AuthCard>
  );
}