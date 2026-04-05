'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-text-tertiary hover:text-accent transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? 'text-text-primary font-medium' : 'text-text-tertiary')}>
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}