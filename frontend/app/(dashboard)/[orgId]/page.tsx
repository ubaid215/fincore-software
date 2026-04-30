'use client';
// src/app/(dashboard)/[orgId]/page.tsx

import { useEffect, useState } from 'react';
import { useParams }           from 'next/navigation';
import Link                    from 'next/link';
import {
  FileText, Receipt, Users, TrendingUp, ArrowUpRight,
  Plus, ChevronRight, Zap, CheckCircle2, Clock, Lock,
} from 'lucide-react';
import { useAuthStore, useOrgPayload, useIsHydrated } from '../../../stores/auth.store';
import { authApi }  from '../../../lib/auth-api';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color, href }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; href?: string;
}) {
  const content = (
    <div
      className="card group hover:shadow-md transition-all duration-200 cursor-pointer"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: color + '20' }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        {href && (
          <ArrowUpRight
            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
        )}
      </div>
      <div className="mt-3">
        <p
          className="text-2xl font-semibold font-mono"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.025em' }}
        >
          {value}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        {sub && (
          <p className="text-xs mt-1 font-medium" style={{ color }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ── Quick action ──────────────────────────────────────────────────────────────

function QuickAction({ label, icon, href, description }: {
  label: string; icon: React.ReactNode; href: string; description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg border transition-all
                 hover:border-[--color-border-2] hover:shadow-sm active:scale-[0.99] group"
      style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-accent-subtle)' }}
      >
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{description}</p>
      </div>
      <ChevronRight
        className="w-4 h-4 flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--color-text-tertiary)' }}
      />
    </Link>
  );
}

// ── Locked app tile ───────────────────────────────────────────────────────────

function LockedAction({ label, description, upgradeHref }: {
  label: string; description: string; upgradeHref: string;
}) {
  return (
    <Link
      href={upgradeHref}
      className="flex items-center gap-3 p-3 rounded-lg border border-dashed
                 transition-all hover:border-[--color-accent-muted] group"
      style={{ borderColor: 'var(--color-border-2)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-surface)' }}
      >
        <Lock className="w-3.5 h-3.5" style={{ color: 'var(--color-text-disabled)' }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        <p className="text-xs truncate" style={{ color: 'var(--color-text-disabled)' }}>{description}</p>
      </div>
      <Zap className="w-3.5 h-3.5 flex-shrink-0 ml-auto" style={{ color: 'var(--color-text-disabled)' }} />
    </Link>
  );
}

// ── Free trial banner ─────────────────────────────────────────────────────────

function FreeTrialBanner({ orgId, daysLeft }: { orgId: string; daysLeft?: number }) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl border text-sm"
      style={{ background: 'var(--color-warning-subtle)', borderColor: '#f5d67a' }}
    >
      <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
      <div style={{ color: 'var(--color-warning-text)' }}>
        <strong>Free plan{daysLeft !== undefined ? ` · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : ''}</strong>
        {' '}— Limited to 1 user, 1 app, and 50 invoices/month.{' '}
        <Link href={`/${orgId}/settings/billing`} className="font-semibold underline">
          Upgrade to unlock everything →
        </Link>
      </div>
    </div>
  );
}

// ── Onboarding checklist ─────────────────────────────────────────────────────

function OnboardingChecklist({ orgId, apps }: { orgId: string; apps: string[] }) {
  const steps = [
    { label: 'Add your first contact',        href: `/${orgId}/contacts/new`,         done: false, app: 'CONTACTS'   },
    { label: 'Create your first invoice',     href: `/${orgId}/invoices/new`,          done: false, app: 'INVOICING'  },
    { label: 'Set up your chart of accounts', href: `/${orgId}/accounts`,              done: false, app: 'ACCOUNTING' },
    { label: 'Invite a team member',          href: `/${orgId}/settings/members`,      done: false },
  ].filter((s) => !s.app || apps.includes(s.app));

  const completedCount = steps.filter((s) => s.done).length;
  const pct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="card" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Getting started
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {completedCount} of {steps.length} completed
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold font-mono"
          style={{
            background: `conic-gradient(var(--color-accent) ${pct}%, var(--color-surface-2) 0)`,
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div className="h-1.5 rounded-full mb-4" style={{ background: 'var(--color-surface-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: pct + '%', background: 'var(--color-accent)' }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-[--color-surface]"
          >
            <div
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{
                borderColor: step.done ? 'var(--color-success)' : 'var(--color-border-2)',
                background:  step.done ? 'var(--color-success-subtle)' : 'transparent',
              }}
            >
              {step.done && <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--color-success)' }} />}
            </div>
            <span className="text-sm" style={{
              color:          step.done ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
              textDecoration: step.done ? 'line-through' : undefined,
            }}>
              {step.label}
            </span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── All available quick-action definitions ────────────────────────────────────

const ALL_ACTIONS = [
  { app: 'INVOICING',    label: 'New Invoice',   icon: <FileText className="w-4 h-4" />, description: 'Create and send an invoice',  path: 'invoices/new'  },
  { app: 'EXPENSES',     label: 'Log Expense',   icon: <Receipt  className="w-4 h-4" />, description: 'Record a business expense',   path: 'expenses/new'  },
  { app: 'CONTACTS',     label: 'Add Contact',   icon: <Users    className="w-4 h-4" />, description: 'Add a client or vendor',      path: 'contacts/new'  },
  { app: 'PAYROLL',      label: 'Run Payroll',   icon: <TrendingUp className="w-4 h-4" />, description: 'Process employee payroll', path: 'payroll/run'   },
  { app: 'INVENTORY',    label: 'Add Product',   icon: <Plus     className="w-4 h-4" />, description: 'Add inventory item',          path: 'inventory/new' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const params     = useParams<{ orgId: string }>();
  const orgId      = params.orgId;
  const user       = useAuthStore((s) => s.user);
  const payload    = useOrgPayload();
  const isHydrated = useIsHydrated();

  // Org context may still be loading on first render — wait for hydration
  const apps    = payload?.apps    ?? [];
  const plan    = payload?.plan    ?? 'FREE';
  const isFree  = plan === 'FREE' || plan === 'TRIALING';
  const isSuperAdmin = payload?.isSuperAdmin ?? false;

  // Free-trial days remaining (approximate from subscription data in membership)
  const membership = useAuthStore((s) =>
    s.memberships.find((m) => m.organization.id === orgId)
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const enabledActions = ALL_ACTIONS.filter((a) => apps.includes(a.app));
  const lockedActions  = isFree
    ? ALL_ACTIONS.filter((a) => !apps.includes(a.app)).slice(0, 2)
    : [];

  // If not yet hydrated, show a lightweight skeleton
  if (!isHydrated) {
    return (
      <div className="space-y-6 max-w-5xl animate-pulse">
        <div className="h-8 w-64 rounded-lg" style={{ background: 'var(--color-surface-2)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl" style={{ background: 'var(--color-surface-2)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Welcome header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.020em' }}
          >
            {greeting()}, {user?.firstName ?? 'there'} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        {isFree && !isSuperAdmin && (
          <Link
            href={`/${orgId}/settings/billing`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
                       transition-all hover:shadow-sm"
            style={{
              background:  'var(--color-accent-subtle)',
              borderColor: 'var(--color-accent-muted)',
              color:       'var(--color-accent-text)',
            }}
          >
            <Zap className="w-4 h-4" />
            Upgrade plan
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}

        {isSuperAdmin && (
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            ⚡ Super Admin
          </span>
        )}
      </div>

      {/* ── Free trial banner ─────────────────────────────────────────────── */}
      {isFree && !isSuperAdmin && (
        <FreeTrialBanner orgId={orgId} />
      )}

      {/* ── Stats grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Revenue this month"
          value="₨ 0"
          icon={<TrendingUp className="w-4 h-4" />}
          color="var(--color-success)"
          href={apps.includes('REPORTS') ? `/${orgId}/reports` : undefined}
        />
        <StatCard
          label="Invoices due"
          value="0"
          sub="No overdue invoices"
          icon={<FileText className="w-4 h-4" />}
          color="var(--color-accent)"
          href={apps.includes('INVOICING') ? `/${orgId}/invoices` : undefined}
        />
        <StatCard
          label="Pending expenses"
          value="0"
          icon={<Receipt className="w-4 h-4" />}
          color="var(--color-warning)"
          href={apps.includes('EXPENSES') ? `/${orgId}/expenses` : undefined}
        />
        <StatCard
          label="Active contacts"
          value="0"
          icon={<Users className="w-4 h-4" />}
          color="var(--color-info)"
          href={apps.includes('CONTACTS') ? `/${orgId}/contacts` : undefined}
        />
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Quick actions
          </h2>

          {enabledActions.length === 0 && lockedActions.length === 0 ? (
            // No apps enabled at all — nudge to settings
            <div
              className="flex flex-col items-center gap-3 p-8 rounded-xl border border-dashed text-center"
              style={{ borderColor: 'var(--color-border-2)' }}
            >
              <Zap className="w-8 h-8" style={{ color: 'var(--color-text-disabled)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  No apps enabled yet
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-disabled)' }}>
                  Go to Settings → Apps to enable modules for your plan.
                </p>
              </div>
              <Link
                href={`/${orgId}/settings/apps`}
                className="text-sm font-medium underline"
                style={{ color: 'var(--color-accent)' }}
              >
                Enable apps →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enabledActions.map((a) => (
                <QuickAction
                  key={a.path}
                  label={a.label}
                  icon={a.icon}
                  href={`/${orgId}/${a.path}`}
                  description={a.description}
                />
              ))}
              {lockedActions.map((a) => (
                <LockedAction
                  key={a.path}
                  label={a.label}
                  description={`Upgrade to unlock ${a.label.toLowerCase()}`}
                  upgradeHref={`/${orgId}/settings/billing`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Onboarding checklist */}
        <div>
          <OnboardingChecklist orgId={orgId} apps={apps} />
        </div>
      </div>

      {/* ── Plan info footer (free trial only) ───────────────────────────── */}
      {isFree && !isSuperAdmin && apps.length > 0 && (
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl border text-sm flex-wrap"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent-text)' }}
            >
              {plan}
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Active app{apps.length !== 1 ? 's' : ''}: {apps.join(', ')}
            </span>
          </div>
          <Link
            href={`/${orgId}/settings/billing`}
            className="text-sm font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            View plan details →
          </Link>
        </div>
      )}
    </div>
  );
}
