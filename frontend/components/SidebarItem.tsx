'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Tooltip } from '@/shared/ui'

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: (orgId: string) => string
  exact?: boolean
  children?: Array<{
    label: string
    href: (orgId: string) => string
  }>
}

interface SidebarItemProps {
  item: NavItem
  orgId: string
  collapsed: boolean
  isActive: boolean
}

export function SidebarItem({ item, orgId, collapsed, isActive }: SidebarItemProps) {
  const [isExpanded, setIsExpanded] = useState(isActive)
  const Icon = item.icon
  const hasChildren = item.children && item.children.length > 0

  const handleClick = () => {
    if (hasChildren && !collapsed) {
      setIsExpanded(!isExpanded)
    }
  }

  const linkContent = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-accent-subtle text-accent'
          : 'text-text-tertiary hover:bg-surface hover:text-text-primary',
        collapsed && 'justify-center px-2',
      )}
      onClick={handleClick}
    >
      <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-accent')} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {hasChildren && (
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
            />
          )}
        </>
      )}
    </div>
  )

  const renderLink = () => {
    if (hasChildren && !collapsed) {
      return (
        <div className="space-y-1">
          <div className="cursor-pointer">{linkContent}</div>
          {isExpanded && (
            <div className="ml-4 space-y-1 border-l border-border pl-2">
              {item.children!.map((child) => {
                const childHref = child.href(orgId)
                const isChildActive = window.location.pathname === childHref
                return (
                  <Link
                    key={child.label}
                    href={childHref}
                    className={cn(
                      'block rounded-md px-3 py-1.5 text-sm transition-colors',
                      isChildActive
                        ? 'bg-accent-subtle text-accent'
                        : 'text-text-tertiary hover:bg-surface hover:text-text-primary',
                    )}
                  >
                    {child.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    const link = (
      <Link href={item.href(orgId)} className="block">
        {linkContent}
      </Link>
    )

    if (collapsed) {
      return <Tooltip content={item.label}>{link}</Tooltip>
    }

    return link
  }

  return renderLink()
}