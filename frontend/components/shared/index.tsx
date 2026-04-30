'use client';
// components/shared/index.tsx
// Barrel of lightweight shared components — no external dependencies

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

// ── Status Badge ──────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'accent';

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: 'var(--color-success-subtle)', color: 'var(--color-success-text)' },
  warning: { bg: 'var(--color-warning-subtle)', color: 'var(--color-warning-text)' },
  danger:  { bg: 'var(--color-danger-subtle)',  color: 'var(--color-danger-text)'  },
  info:    { bg: 'var(--color-info-subtle)',     color: 'var(--color-info-text)'    },
  accent:  { bg: 'var(--color-accent-subtle)',   color: 'var(--color-accent-text)'  },
  default: { bg: 'var(--color-surface-2)',       color: 'var(--color-text-tertiary)'},
};

interface StatusBadgeProps {
  label:    string;
  variant?: BadgeVariant;
  dot?:     boolean;
}

export function StatusBadge({ label, variant = 'default', dot }: StatusBadgeProps) {
  const s = BADGE_STYLES[variant];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />}
      {label}
    </span>
  );
}

// ── Contact type → badge variant ─────────────────────────────────────────────

export const CONTACT_TYPE_BADGE: Record<string, BadgeVariant> = {
  CUSTOMER: 'accent',
  VENDOR:   'info',
  BOTH:     'warning',
  LEAD:     'default',
  BANK:     'success',
  PARTNER:  'accent',
  INTERNAL: 'default',
};

// ── Appointment status → badge ────────────────────────────────────────────────

export const APT_STATUS_BADGE: Record<string, BadgeVariant> = {
  SCHEDULED:  'info',
  CONFIRMED:  'accent',
  COMPLETED:  'success',
  NO_SHOW:    'warning',
  CANCELLED:  'danger',
};

// ── Event status → badge ──────────────────────────────────────────────────────

export const EVENT_STATUS_BADGE: Record<string, BadgeVariant> = {
  CONFIRMED:  'success',
  TENTATIVE:  'warning',
  CANCELLED:  'danger',
};

// ── Empty State ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  action?:      { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-disabled)' }}
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</p>
      {description && (
        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href
            ? <Link href={action.href} className="inline-flex items-center px-4 h-9 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>{action.label}</Link>
            : <button onClick={action.onClick} className="inline-flex items-center px-4 h-9 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>{action.label}</button>
          }
        </div>
      )}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?:    'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?:    React.ReactNode;
  children?: React.ReactNode;
}

const BTN_SIZE = { sm: 'h-7 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-10 px-5 text-sm' };

export function Btn({ variant = 'primary', size = 'md', loading, icon, children, disabled, ...rest }: BtnProps) {
  const base = `inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-120 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${BTN_SIZE[size]}`;
  const vars = {
    primary: 'text-white',
    outline: 'border',
    ghost:   '',
    danger:  '',
  };
  const inlineStyle = {
    primary: { background: 'var(--color-accent)',        color: 'white' },
    outline: { background: 'var(--color-white)',         borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' },
    ghost:   { background: 'transparent',               color: 'var(--color-text-secondary)' },
    danger:  { background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)' },
  };

  return (
    <button className={`${base} ${vars[variant]}`} style={inlineStyle[variant]} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

// ── Search input ──────────────────────────────────────────────────────────────

import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 pr-8 text-sm rounded-lg border w-full sm:w-64"
        style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded" style={{ color: 'var(--color-text-tertiary)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Smart button (Odoo-style header badge) ────────────────────────────────────

interface SmartButtonProps {
  label:  string;
  count:  number | string;
  icon:   React.ReactNode;
  href?:  string;
  color?: string;
}

export function SmartButton({ label, count, icon, href, color = 'var(--color-accent)' }: SmartButtonProps) {
  const inner = (
    <div
      className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border transition-all hover:shadow-sm active:scale-[0.98] cursor-pointer min-w-[80px]"
      style={{ background: 'var(--color-white)', borderColor: 'var(--color-border)' }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-lg font-semibold font-mono leading-none" style={{ color: 'var(--color-text-primary)' }}>
        {count}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  name:     string;
  imageUrl?: string | null;
  size?:    'sm' | 'md' | 'lg' | 'xl';
}

const AVATAR_SIZES = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' };

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (imageUrl) return <img src={imageUrl} alt={name} className={`${AVATAR_SIZES[size]} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${AVATAR_SIZES[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ background: 'var(--color-accent)' }}>
      {initials}
    </div>
  );
}