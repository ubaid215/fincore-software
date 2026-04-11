'use client'

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
  HelpCircle,
  LogOut,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Button } from '@/shared/ui'
import { features } from '@/config/app.config'
import { usePermission } from '@/shared/hooks/usePermission'
import { useLogout } from '@/modules/auth/hooks/useLogout'
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
    href: (orgId: string) => `/${orgId}`,
    exact: true,
  },
  {
    label: 'Invoicing',
    icon: Receipt,
    href: (orgId: string) => `/${orgId}/invoices`,
  },
  {
    label: 'Expenses',
    icon: FileText,
    href: (orgId: string) => `/${orgId}/expenses`,
  },
  {
    label: 'Ledger',
    icon: BookOpen,
    href: (orgId: string) => `/${orgId}/accounts`,
    children: [
      { label: 'Chart of Accounts', href: (orgId: string) => `/${orgId}/accounts` },
      { label: 'Journal Entries', href: (orgId: string) => `/${orgId}/journal` },
      { label: 'Trial Balance', href: (orgId: string) => `/${orgId}/trial-balance` },
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    href: (orgId: string) => `/${orgId}/inventory`,
    featureFlag: 'inventory',
    requiredRole: 'VIEWER',
  },
  {
    label: 'Payroll',
    icon: UsersIcon,
    href: (orgId: string) => `/${orgId}/payroll`,
    featureFlag: 'payroll',
    requiredRole: 'ADMIN',
  },
  {
    label: 'Reports',
    icon: BarChart3,
    href: (orgId: string) => `/${orgId}/reports`,
    children: [
      { label: 'Profit & Loss', href: (orgId: string) => `/${orgId}/reports/profit-loss` },
      { label: 'Balance Sheet', href: (orgId: string) => `/${orgId}/reports/balance-sheet` },
      { label: 'Cash Flow', href: (orgId: string) => `/${orgId}/reports/cash-flow` },
      { label: 'Aged Receivables', href: (orgId: string) => `/${orgId}/reports/aged-receivables` },
      { label: 'Aged Payables', href: (orgId: string) => `/${orgId}/reports/aged-payables` },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    href: (orgId: string) => `/${orgId}/settings`,
    children: [
      { label: 'Organization', href: (orgId: string) => `/${orgId}/settings` },
      { label: 'Members', href: (orgId: string) => `/${orgId}/settings/members` },
      { label: 'Billing', href: (orgId: string) => `/${orgId}/settings/billing` },
      { label: 'Profile', href: (orgId: string) => `/${orgId}/settings/profile` },
    ],
  },
]

export function Sidebar({ collapsed, onToggle, orgId }: SidebarProps) {
  const pathname = usePathname()
  const { hasMinRole } = usePermission()
  const { mutate: logout, isPending: isLoggingOut } = useLogout()

  const filteredNavItems = navItems.filter((item) => {
    if (item.featureFlag && !features[item.featureFlag as keyof typeof features]) {
      return false
    }
    if (item.requiredRole && !hasMinRole(item.requiredRole as never)) {
      return false
    }
    return true
  })

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 z-20 flex h-[calc(100vh-3.5rem)] flex-col bg-white border-r border-border transition-all duration-300 ease-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo Area */}
      <div className={cn(
        'flex h-14 items-center border-b border-border px-4',
        collapsed && 'justify-center px-2',
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white text-sm font-bold">F</span>
            </div>
            <span className="text-base font-semibold text-text-primary">Fincore</span>
          </div>
        ) : (
          <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-sm font-bold">F</span>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="flex justify-end p-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0 hover:bg-surface"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredNavItems.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            orgId={orgId}
            collapsed={collapsed}
            isActive={
              pathname === item.href(orgId) ||
              (item.children?.some((child) => pathname === child.href(orgId)) ?? false)
            }
          />
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-border p-3 space-y-2">
        {!collapsed ? (
          <>
            <button
              onClick={() => {}}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-tertiary transition-all hover:bg-surface hover:text-text-primary"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Help &amp; Support</span>
            </button>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger transition-all hover:bg-danger-subtle disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className={cn('h-4 w-4', isLoggingOut && 'animate-spin')} />
              <span>{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {}}
              className="flex w-full justify-center rounded-lg p-2 text-text-tertiary transition-all hover:bg-surface"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="flex w-full justify-center rounded-lg p-2 text-danger transition-all hover:bg-danger-subtle disabled:opacity-50"
            >
              <LogOut className={cn('h-4 w-4', isLoggingOut && 'animate-spin')} />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}