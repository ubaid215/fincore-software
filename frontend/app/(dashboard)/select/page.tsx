'use client';
// src/app/(dashboard)/select/page.tsx
// Shown after login when user belongs to multiple orgs.
// Renders an org card grid — clicking selects the org and issues an org-scoped token.

import { useState }      from 'react';
import { useRouter }     from 'next/navigation';
import { toast }         from 'sonner';
import { Building2, ChevronRight, Plus, LogOut, Crown, Shield, Eye } from 'lucide-react';
import { useAuth }       from '../../../hooks/useAuth';
import { useMemberships } from '../../../stores/auth.store';
import type { OrgMembership, UserRole } from '../../../types/auth';

// Badge colours per role
const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string }> = {
  OWNER:      { label: 'Owner',      color: 'var(--color-accent-text)',  bg: 'var(--color-accent-subtle)' },
  ADMIN:      { label: 'Admin',      color: 'var(--color-info-text)',    bg: 'var(--color-info-subtle)' },
  ACCOUNTANT: { label: 'Accountant', color: 'var(--color-text-primary)', bg: 'var(--color-surface-2)' },
  MANAGER:    { label: 'Manager',    color: 'var(--color-text-primary)', bg: 'var(--color-surface-2)' },
  VIEWER:     { label: 'Viewer',     color: 'var(--color-text-tertiary)',bg: 'var(--color-surface)' },
  CLIENT:     { label: 'Client',     color: 'var(--color-text-tertiary)',bg: 'var(--color-surface)' },
};

const ROLE_ICON: Record<UserRole, React.ReactNode> = {
  OWNER:      <Crown className="w-3 h-3" />,
  ADMIN:      <Shield className="w-3 h-3" />,
  ACCOUNTANT: null,
  MANAGER:    null,
  VIEWER:     <Eye className="w-3 h-3" />,
  CLIENT:     <Eye className="w-3 h-3" />,
};

function OrgCard({ membership, onSelect, isLoading }: {
  membership: OrgMembership;
  onSelect:   () => void;
  isLoading:  boolean;
}) {
  const { organization: org, role } = membership;
  const cfg = ROLE_CONFIG[role];
  const planName = org.subscription?.plan?.displayName ?? 'Free';

  // Avatar letters
  const initials = org.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <button
      onClick={onSelect}
      disabled={isLoading}
      className="w-full group flex items-center gap-4 p-4 rounded-xl border text-left
                 transition-all duration-150 hover:border-[--color-border-2]
                 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background:  'var(--color-white)',
        borderColor: 'var(--color-border)',
        boxShadow:   '0 1px 2px 0 rgba(26,25,22,0.04)',
      }}
    >
      {/* Org avatar */}
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0
                   text-white font-semibold text-sm"
        style={{ background: 'var(--color-accent)' }}
      >
        {org.logoUrl
          ? <img src={org.logoUrl} alt={org.name} className="w-full h-full rounded-lg object-cover" />
          : initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
            {org.name}
          </p>
          {/* Role badge */}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            {ROLE_ICON[role]}
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {planName} plan
          </span>
          {org.status !== 'ACTIVE' && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning-text)' }}
            >
              {org.status}
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--color-text-tertiary)' }}
      />
    </button>
  );
}

export default function SelectOrgPage() {
  const { selectOrg, logout } = useAuth();
  const memberships           = useMemberships();
  const router                = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (orgId: string) => {
    setLoadingId(orgId);
    try {
      await selectOrg(orgId);
      router.push(`/${orgId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to switch organization');
      setLoadingId(null);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--color-canvas)' }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          {/* Logo */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-accent)' }}
          >
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.020em' }}
          >
            Select organization
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {memberships.length === 0
              ? 'You are not part of any organization yet.'
              : `You belong to ${memberships.length} organization${memberships.length > 1 ? 's' : ''}.`}
          </p>
        </div>

        {/* Org list */}
        <div className="space-y-2">
          {memberships.map((m) => (
            <OrgCard
              key={m.organization.id}
              membership={m}
              onSelect={() => handleSelect(m.organization.id)}
              isLoading={loadingId === m.organization.id}
            />
          ))}

          {memberships.length === 0 && (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}
            >
              <Building2 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-disabled)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No organizations found.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border
                       text-sm font-medium transition-all hover:border-[--color-border-2]
                       active:scale-[0.99]"
            style={{
              background:  'var(--color-white)',
              borderColor: 'var(--color-border)',
              color:       'var(--color-text-primary)',
            }}
          >
            <Plus className="w-4 h-4" />
            Create new organization
          </button>

          <button
            onClick={logout}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-lg
                       text-sm font-medium transition-all"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}