'use client';
// src/app/(dashboard)/[orgId]/layout.tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link          from 'next/link';
import { toast }     from 'sonner';
import {
  LayoutDashboard, FileText, Receipt, Users, Package,
  BarChart3, Calendar, CalendarClock, FolderOpen,
  Settings, LogOut, ChevronLeft, ChevronRight,
  Building2, Bell, Search, Menu, X, Crown, Shield,
  CreditCard, BookOpen, Wallet,
} from 'lucide-react';
import { useAuth }           from '../../../hooks/useAuth';
import { useAuthStore, useCurrentOrg, useOrgPayload } from '../../../stores/auth.store';
import type { AppKey }       from '../../../types/auth';

// ── Nav item definition ────────────────────────────────────────────────────────

interface NavItem {
  href:     string;
  label:    string;
  icon:     React.ReactNode;
  app?:     AppKey;             // if set, only shown when app is enabled
  badge?:   number;
}

function buildNav(orgId: string): NavItem[] {
  return [
    { href: `/${orgId}`,               label: 'Dashboard',     icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: `/${orgId}/invoices`,       label: 'Invoicing',     icon: <FileText className="w-4 h-4" />,   app: 'INVOICING' },
    { href: `/${orgId}/expenses`,       label: 'Expenses',      icon: <Receipt className="w-4 h-4" />,    app: 'EXPENSES' },
    { href: `/${orgId}/contacts`,       label: 'Contacts',      icon: <Users className="w-4 h-4" />,      app: 'CONTACTS' },
    { href: `/${orgId}/inventory`,      label: 'Inventory',     icon: <Package className="w-4 h-4" />,    app: 'INVENTORY' },
    { href: `/${orgId}/payroll`,        label: 'Payroll',       icon: <Wallet className="w-4 h-4" />,     app: 'PAYROLL' },
    { href: `/${orgId}/accounts`,       label: 'Accounts',      icon: <BookOpen className="w-4 h-4" />,   app: 'ACCOUNTING' },
    { href: `/${orgId}/bank`,           label: 'Bank Recon',    icon: <CreditCard className="w-4 h-4" />, app: 'BANK_RECON' },
    { href: `/${orgId}/calendar`,       label: 'Calendar',      icon: <Calendar className="w-4 h-4" />,   app: 'CALENDAR' },
    { href: `/${orgId}/appointments`,   label: 'Appointments',  icon: <CalendarClock className="w-4 h-4" />, app: 'APPOINTMENTS' },
    { href: `/${orgId}/documents`,      label: 'Documents',     icon: <FolderOpen className="w-4 h-4" />, app: 'DOCUMENTS' },
    { href: `/${orgId}/reports`,        label: 'Reports',       icon: <BarChart3 className="w-4 h-4" />,  app: 'REPORTS' },
  ];
}

const BOTTOM_NAV = (orgId: string): NavItem[] => [
  { href: `/${orgId}/settings`, label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

// ── Sidebar nav item ────────────────────────────────────────────────────────────

function NavLink({
  item, collapsed, active, orgApps,
}: {
  item:     NavItem;
  collapsed: boolean;
  active:   boolean;
  orgApps:  string[];
}) {
  // Hide app-specific items when app is not enabled
  if (item.app && !orgApps.includes(item.app)) return null;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`
        flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium
        transition-all duration-120 group relative
        ${collapsed ? 'justify-center' : ''}
      `}
      style={{
        background: active ? 'var(--color-accent-subtle)' : 'transparent',
        color:      active ? 'var(--color-accent-text)'   : 'var(--color-text-tertiary)',
      }}
    >
      <span className="flex-shrink-0" style={{ color: active ? 'var(--color-accent)' : undefined }}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <span
          className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--color-accent)', color: 'white', fontSize: '0.6875rem' }}
        >
          {item.badge}
        </span>
      )}
      {/* Tooltip when collapsed */}
      {collapsed && (
        <span
          className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap
                     opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
          style={{ background: 'var(--color-text-primary)', color: 'white' }}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

// ── Main layout ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params      = useParams<{ orgId: string }>();
  const orgId       = params.orgId;
  const router      = useRouter();
  const pathname    = usePathname();
  const { logout, selectOrg } = useAuth();
  const currentOrg  = useCurrentOrg();
  const orgPayload  = useOrgPayload();
  const user        = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);

  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [notifCount,   setNotifCount]   = useState(0);

  const orgApps = orgPayload?.apps ?? currentOrg?.organization.appAccess.map((a) => a.app) ?? [];
  const nav     = buildNav(orgId);

  // Auto-select org when navigating directly to an orgId URL
  useEffect(() => {
    if (!orgPayload || orgPayload.orgId !== orgId) {
      selectOrg(orgId).catch(() => {
        toast.error('You do not have access to this organization');
        router.push('/select');
      });
    }
  }, [orgId]);

  const handleLogout = async () => {
    await logout();
  };

  const userInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  const roleIcon = orgPayload?.role === 'OWNER'
    ? <Crown className="w-3 h-3" style={{ color: 'var(--color-accent)' }} />
    : orgPayload?.role === 'ADMIN'
    ? <Shield className="w-3 h-3" style={{ color: 'var(--color-info)' }} />
    : null;

  return (
    <div className="app-shell">
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="app-topbar">
        {/* Mobile menu toggle */}
        <button
          className="lg:hidden p-2 rounded-lg mr-2"
          style={{ color: 'var(--color-text-tertiary)' }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo + org name */}
        <div className="flex items-center gap-2.5 mr-6">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            <span className="text-white font-bold text-xs">F</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {currentOrg?.organization.name ?? 'FinCore'}
            </span>
            {currentOrg?.organization.subscription?.plan && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent-text)' }}
              >
                {currentOrg.organization.subscription.plan.displayName}
              </span>
            )}
          </div>
        </div>

        {/* Search — desktop only */}
        <div className="hidden md:flex flex-1 max-w-sm">
          <div
            className="flex items-center gap-2 w-full h-8 px-3 rounded-lg border text-sm"
            style={{
              background:  'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color:       'var(--color-text-tertiary)',
            }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs">Search…</span>
            <kbd
              className="ml-auto text-xs px-1 rounded"
              style={{ background: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
            >
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Notifications */}
          <button
            className="relative p-2 rounded-lg transition-colors hover:bg-[--color-surface]"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notifCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: 'var(--color-danger)' }}
              />
            )}
          </button>

          {/* Org switcher */}
          {memberships.length > 1 && (
            <button
              className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-xs font-medium
                         transition-all hover:border-[--color-border-2]"
              style={{
                background:  'var(--color-white)',
                borderColor: 'var(--color-border)',
                color:       'var(--color-text-secondary)',
              }}
              onClick={() => router.push('/select')}
            >
              <Building2 className="w-3.5 h-3.5" />
              Switch org
            </button>
          )}

          {/* User avatar */}
          <button
            className="flex items-center gap-2 ml-1 pl-2 pr-1 h-8 rounded-lg
                       transition-all hover:bg-[--color-surface]"
            onClick={handleLogout}
            title="Sign out"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: 'var(--color-accent)' }}
            >
              {userInitials}
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {roleIcon}
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.firstName}
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] lg:hidden"
          style={{ background: 'rgba(26,25,22,0.4)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`app-sidebar ${mobileOpen ? 'is-open' : ''}`}
        style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      >
        <div className="flex flex-col h-full">
          {/* Collapse toggle — desktop */}
          <div className="hidden lg:flex items-center justify-end p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="p-1.5 rounded-lg transition-colors hover:bg-[--color-surface]"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed
                ? <ChevronRight className="w-4 h-4" />
                : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Main nav */}
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {nav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={pathname === item.href || (item.href !== `/${orgId}` && pathname.startsWith(item.href))}
                orgApps={orgApps}
              />
            ))}
          </nav>

          {/* Bottom nav */}
          <div className="px-2 py-3 border-t space-y-0.5" style={{ borderColor: 'var(--color-border)' }}>
            {BOTTOM_NAV(orgId).map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={pathname.startsWith(item.href)}
                orgApps={orgApps}
              />
            ))}
            <button
              onClick={handleLogout}
              className={`
                flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium w-full
                transition-all hover:bg-[--color-danger-subtle]
                ${collapsed ? 'justify-center' : ''}
              `}
              style={{ color: 'var(--color-text-tertiary)' }}
              title={collapsed ? 'Sign out' : undefined}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}