'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  FileText,
  BookOpen,
  Package,
  Users as UsersIcon,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet,
  Building2,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Button } from '@/shared/ui'
import { features } from '@/config/app.config'
import { usePermission } from '@/shared/hooks/usePermission'
import { SidebarItem } from './SidebarItem'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  orgId: string
}

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: (orgId: string) => `/dashboard/${orgId}`,
    exact: true,
  },
  {
    label: 'Invoicing',
    icon: Receipt,
    href: (orgId: string) => `/dashboard/${orgId}/invoices`,
  },
  {
    label: 'Expenses',
    icon: FileText,
    href: (orgId: string) => `/dashboard/${orgId}/expenses`,
  },
  {
    label: 'Ledger',
    icon: BookOpen,
    href: (orgId: string) => `/dashboard/${orgId}/accounts`,
    children: [
      { label: 'Chart of Accounts', href: (orgId: string) => `/dashboard/${orgId}/accounts` },
      { label: 'Journal Entries', href: (orgId: string) => `/dashboard/${orgId}/journal` },
      { label: 'Trial Balance', href: (orgId: string) => `/dashboard/${orgId}/trial-balance` },
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    href: (orgId: string) => `/dashboard/${orgId}/inventory`,
    featureFlag: 'inventory',
    requiredRole: 'VIEWER',
  },
  {
    label: 'Payroll',
    icon: UsersIcon,
    href: (orgId: string) => `/dashboard/${orgId}/payroll`,
    featureFlag: 'payroll',
    requiredRole: 'ADMIN',
  },
  {
    label: 'Reports',
    icon: BarChart3,
    href: (orgId: string) => `/dashboard/${orgId}/reports`,
    children: [
      { label: 'Profit & Loss', href: (orgId: string) => `/dashboard/${orgId}/reports/profit-loss` },
      { label: 'Balance Sheet', href: (orgId: string) => `/dashboard/${orgId}/reports/balance-sheet` },
      { label: 'Cash Flow', href: (orgId: string) => `/dashboard/${orgId}/reports/cash-flow` },
      { label: 'Aged Receivables', href: (orgId: string) => `/dashboard/${orgId}/reports/aged-receivables` },
      { label: 'Aged Payables', href: (orgId: string) => `/dashboard/${orgId}/reports/aged-payables` },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    href: (orgId: string) => `/dashboard/${orgId}/settings`,
    children: [
      { label: 'Organization', href: (orgId: string) => `/dashboard/${orgId}/settings` },
      { label: 'Members', href: (orgId: string) => `/dashboard/${orgId}/settings/members` },
      { label: 'Billing', href: (orgId: string) => `/dashboard/${orgId}/settings/billing` },
      { label: 'Profile', href: (orgId: string) => `/dashboard/${orgId}/settings/profile` },
    ],
  },
]

export function Sidebar({ collapsed, onToggle, orgId }: SidebarProps) {
  const pathname = usePathname()
  const { canAccessModule, hasMinRole } = usePermission()

  const filteredNavItems = navItems.filter((item) => {
    // Check feature flag
    if (item.featureFlag && !features[item.featureFlag as keyof typeof features]) {
      return false
    }
    // Check role
    if (item.requiredRole && !hasMinRole(item.requiredRole as any)) {
      return false
    }
    return true
  })

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 z-20 h-[calc(100vh-3.5rem)] bg-white border-r border-border transition-all duration-300 ease-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-full flex-col">
        {/* Collapse toggle */}
        <div className="flex justify-end p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {filteredNavItems.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              orgId={orgId}
              collapsed={collapsed}
              isActive={pathname === item.href(orgId) || 
                (item.children?.some(child => pathname === child.href(orgId)))}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2">
          <div className={cn('rounded-md bg-surface p-2', collapsed && 'text-center')}>
            {!collapsed ? (
              <>
                <p className="text-xs text-text-tertiary">Need help?</p>
                <p className="text-xs font-medium text-text-secondary">support@fincore.app</p>
              </>
            ) : (
              <Building2 className="mx-auto h-4 w-4 text-text-tertiary" />
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}