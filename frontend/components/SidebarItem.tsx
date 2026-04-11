/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
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

// Child item component to avoid hooks inside map
function ChildNavItem({ 
  child, 
  orgId, 
  isActive 
}: { 
  child: { label: string; href: (orgId: string) => string }
  orgId: string
  isActive: boolean
}) {
  const href = child.href(orgId)
  
  return (
    <Link
      href={href as never}
      className={cn(
        'block rounded-lg px-3 py-2 text-sm transition-all duration-200',
        isActive
          ? 'bg-accent-subtle text-accent font-medium'
          : 'text-text-tertiary hover:bg-surface/60 hover:text-text-primary hover:translate-x-0.5',
      )}
    >
      {child.label}
    </Link>
  )
}

export function SidebarItem({ item, orgId, collapsed, isActive }: SidebarItemProps) {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(isActive && !collapsed)
  const [isHovered, setIsHovered] = useState(false)
  const Icon = item.icon
  const hasChildren = item.children && item.children.length > 0

  // Update expanded state when isActive or collapsed changes
  useEffect(() => {
    if (isActive && hasChildren && !collapsed) {
      setIsExpanded(true)
    } else if (!isActive && !collapsed) {
      // Optional: collapse when not active, comment out if you want to keep manual control
      // setIsExpanded(false)
    }
  }, [isActive, hasChildren, collapsed])

  const handleToggle = (e: React.MouseEvent) => {
    if (hasChildren && !collapsed) {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  const linkContent = (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
        isActive
          ? 'bg-accent-subtle text-accent'
          : 'text-text-tertiary hover:bg-surface/80 hover:text-text-primary',
        collapsed && 'justify-center px-2',
        !collapsed && 'hover:translate-x-0.5',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleToggle}
    >
      {/* Active indicator bar */}
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
      )}
      
      <Icon className={cn(
        'h-5 w-5 shrink-0 transition-all duration-200',
        isActive && 'text-accent',
        isHovered && !isActive && 'scale-105',
      )} />
      
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {hasChildren && (
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-all duration-200',
                isExpanded && 'rotate-180',
              )}
            />
          )}
        </>
      )}
    </div>
  )

  // If has children and not collapsed, render expandable section
  if (hasChildren && !collapsed) {
    return (
      <div className="space-y-1">
        {linkContent}
        <div
          className={cn(
            'ml-4 space-y-1 border-l-2 border-border pl-3 transition-all duration-200 overflow-hidden',
            isExpanded ? 'opacity-100' : 'hidden',
          )}
        >
          {item.children!.map((child) => {
            const childHref = child.href(orgId)
            const isChildActive = pathname === childHref
            
            return (
              <ChildNavItem
                key={child.label}
                child={child}
                orgId={orgId}
                isActive={isChildActive}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Simple link
  const link = (
    <Link href={item.href(orgId) as never} className="block">
      {linkContent}
    </Link>
  )

  if (collapsed) {
    return <Tooltip content={item.label} side="right">{link}</Tooltip>
  }

  return link
}