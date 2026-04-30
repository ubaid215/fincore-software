'use client';
// components/shared/PageHeader.tsx
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Crumb { label: string; href?: string }

interface PageHeaderProps {
  title:       string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?:    React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs mb-1.5" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }} />}
                {crumb.href
                  ? <Link href={crumb.href} className="hover:underline transition-all" style={{ color: 'var(--color-text-tertiary)' }}>{crumb.label}</Link>
                  : <span style={{ color: 'var(--color-text-tertiary)' }}>{crumb.label}</span>
                }
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-tight truncate" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.020em' }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}