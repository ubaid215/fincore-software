'use client';
// src/app/(dashboard)/[orgId]/page.tsx
import { useEffect, useState }   from 'react';
import { useParams }             from 'next/navigation';
import Link                      from 'next/link';
import {
  FileText, Receipt, Users, TrendingUp, ArrowUpRight,
  Plus, ChevronRight, Zap, CheckCircle2,
} from 'lucide-react';
import { useAuthStore, useOrgPayload } from '../../../stores/auth.store';

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

// ── Onboarding checklist ─────────────────────────────────────────────────────

function OnboardingChecklist({ orgId, apps }: { orgId: string; apps: string[] }) {
  const steps = [
    { label: 'Add your first contact',   href: `/${orgId}/contacts/new`,   done: false },
    { label: 'Create your first invoice', href: `/${orgId}/invoices/new`,   done: false, app: 'INVOICING' },
    { label: 'Set up your chart of accounts', href: `/${orgId}/accounts`,  done: false, app: 'ACCOUNTING' },
    { label: 'Invite a team member',     href: `/${orgId}/settings/members`, done: false },
  ].filter((s) => !s.app || apps.includes(s.app));

  const completedCount = steps.filter((s) => s.done).length;
  const pct = Math.round((completedCount / steps.length) * 100);

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
            background:   'conic-gradient(var(--color-accent) ' + pct + '%, var(--color-surface-2) 0)',
            color:        'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Progress bar */}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const params  = useParams<{ orgId: string }>();
  const orgId   = params.orgId;
  const user    = useAuthStore((s) => s.user);
  const payload = useOrgPayload();
  const apps    = payload?.apps ?? [];
  const plan    = payload?.plan ?? 'FREE';
  const isFree  = plan === 'FREE';

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }; 

  const quickActions = [
    apps.includes('INVOICING')    && { label: 'New Invoice',     icon: <FileText className="w-4 h-4" />,   href: `/${orgId}/invoices/new`,     description: 'Create and send an invoice' },
    apps.includes('EXPENSES')     && { label: 'Log Expense',     icon: <Receipt className="w-4 h-4" />,    href: `/${orgId}/expenses/new`,      description: 'Record a business expense' },
    apps.includes('CONTACTS')     && { label: 'Add Contact',     icon: <Users className="w-4 h-4" />,      href: `/${orgId}/contacts/new`,      description: 'Add a client or vendor' },
  ].filter(Boolean) as { label: string; icon: React.ReactNode; href: string; description: string }[];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Welcome header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.020em' }}
          >
            {greeting()}, {user?.firstName} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Free plan upgrade banner */}
        {isFree && (
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
      </div>

      {/* ── Free plan limit banner ────────────────────────────────────────── */}
      {isFree && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl border text-sm"
          style={{
            background:  'var(--color-warning-subtle)',
            borderColor: '#f5d67a',
          }}
        >
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
          <p style={{ color: 'var(--color-warning-text)' }}>
            <strong>Free plan:</strong> 1 user · 1 organization · 50 invoices/month · 1 app.{' '}
            <Link href={`/${orgId}/settings/billing`} className="font-semibold underline">
              Upgrade to unlock everything →
            </Link>
          </p>
        </div>
      )}

      {/* ── Stats grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Revenue this month"
          value="₨ 0"
          icon={<TrendingUp className="w-4 h-4" />}
          color="var(--color-success)"
          href={`/${orgId}/reports`}
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

      {/* ── Two column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Quick actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <QuickAction key={a.href} {...a} />
            ))}
            {/* Upgrade gate for locked apps */}
            {isFree && (
              <Link
                href={`/${orgId}/settings/billing`}
                className="flex items-center gap-3 p-3 rounded-lg border border-dashed
                           transition-all hover:border-[--color-accent-muted] group"
                style={{ borderColor: 'var(--color-border-2)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <Zap className="w-4 h-4" style={{ color: 'var(--color-text-disabled)' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                    Unlock more apps
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                    Payroll, Inventory, Reports…
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Onboarding checklist */}
        <div>
          <OnboardingChecklist orgId={orgId} apps={apps} />
        </div>
      </div>
    </div>
  );
}