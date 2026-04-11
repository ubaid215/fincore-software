'use client';
// src/app/(auth)/invite/accept/page.tsx
import { useEffect, useState } from 'react';
import { useSearchParams }     from 'next/navigation';
import { useRouter }           from 'next/navigation';
import { toast }               from 'sonner';
import { Loader2, CheckCircle2, XCircle, UserPlus } from 'lucide-react';
import { authApi }             from '../../../../lib/auth-api';
import { useAuthStore }        from '../../../../stores/auth.store';
import { AuthCard, AuthButton } from '../../../../components/auth/AuthCard';
import Link from 'next/link';

export default function AcceptInvitePage() {
  const params  = useSearchParams();
  const router  = useRouter();
  const token   = params.get('token');
  const store   = useAuthStore();

  const [status,  setStatus]  = useState<'loading' | 'success' | 'error' | 'auth-required'>('loading');
  const [message, setMessage] = useState('');
  const [orgId,   setOrgId]   = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Invalid invite link'); return; }

    // Must be logged in to accept
    if (!store.accessToken) {
      setStatus('auth-required');
      return;
    }

    authApi.acceptInvite(token)
      .then((result) => {
        setOrgId(result.organizationId);
        setStatus('success');
        // Refresh memberships then redirect after 2s
        authApi.getOrganizations().then((m) => store.setMemberships(m));
        setTimeout(() => router.push(`/${result.organizationId}`), 2000);
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.response?.data?.message ?? 'Invite is invalid, expired, or already accepted.');
      });
  }, [token, store.accessToken]);

  return (
    <AuthCard title="Organization Invitation">
      <div className="py-6 text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Accepting invitation…</p>
          </>
        )}

        {status === 'auth-required' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'var(--color-accent-subtle)' }}>
              <UserPlus className="w-7 h-7" style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              You need to be signed in to accept this invitation.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href={`/login?next=/invite/accept?token=${token}`}
                className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                Sign in to accept
              </Link>
              <Link
                href={`/register?next=/invite/accept?token=${token}`}
                className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                Create account
              </Link>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'var(--color-success-subtle)' }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              You&apos;ve joined the organization! Redirecting to your dashboard…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'var(--color-danger-subtle)' }}>
              <XCircle className="w-7 h-7" style={{ color: 'var(--color-danger)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-danger-text)' }}>{message}</p>
            <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
              ← Back to login
            </Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}