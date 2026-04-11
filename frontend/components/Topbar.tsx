/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, ChevronDown, LogOut, Settings, Users, Building2, Bell } from 'lucide-react'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useWorkspaceStore } from '@/modules/workspace/store/workspace.store'
import { Avatar, Dropdown, Button } from '@/shared/ui'
import { useState } from 'react'

interface TopbarProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

interface DropdownItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  destructive?: boolean
}

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  
  const { user, logout } = useAuthStore()
  const { activeOrganization, organizations, setActiveOrganization } = useWorkspaceStore()

  // Extract orgId from pathname
  const orgMatch = pathname?.match(/^\/dashboard\/([a-zA-Z0-9_-]+)/)
  const currentOrgId = orgMatch?.[1]

  const handleLogout = async () => {
    await logout()
    router.push('/login' as never)
  }

  const handleOrgSwitch = (orgId: string) => {
    setActiveOrganization(orgId)
    router.push(`/dashboard/${orgId}` as never)
  }

  const userMenuItems: DropdownItem[] = [
    {
      label: 'Profile Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => currentOrgId && router.push(`/dashboard/${currentOrgId}/settings/profile` as never),
    },
    {
      label: 'Organization Settings',
      icon: <Building2 className="h-4 w-4" />,
      onClick: () => currentOrgId && router.push(`/dashboard/${currentOrgId}/settings` as never),
    },
    {
      label: 'Members',
      icon: <Users className="h-4 w-4" />,
      onClick: () => currentOrgId && router.push(`/dashboard/${currentOrgId}/settings/members` as never),
    },
    {
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      onClick: handleLogout,
      destructive: true,
    },
  ]

  const orgSwitcherItems: DropdownItem[] = organizations.map((org) => ({
    label: org.name,
    onClick: () => handleOrgSwitch(org.id),
    icon: <Building2 className="h-4 w-4" />,
  }))

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-30 h-14 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="flex h-full items-center justify-between px-4 lg:px-6">
          {/* Left section */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMenuClick}
              className="lg:hidden h-9 w-9 p-0 hover:bg-surface"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Page Title (dynamic) */}
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-text-primary">
                {pathname?.includes('/invoices') ? 'Invoices' :
                 pathname?.includes('/expenses') ? 'Expenses' :
                 pathname?.includes('/accounts') ? 'Chart of Accounts' :
                 pathname?.includes('/reports') ? 'Reports' :
                 'Dashboard'}
              </h1>
            </div>
            
            {/* Org Switcher */}
            {organizations.length > 0 && activeOrganization && (
              <Dropdown
                trigger={
                  <Button variant="secondary" size="sm" className="gap-2 bg-surface/50 hover:bg-surface border-border">
                    <Building2 className="h-4 w-4 text-accent" />
                    <span className="max-w-40 truncate font-medium">{activeOrganization.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
                  </Button>
                }
                items={orgSwitcherItems}
                align="start"
              />
            )}
          </div>

          {/* Center section - Global Search */}
          <div className="hidden md:block">
            <button
              className="flex h-9 w-80 items-center gap-2 rounded-lg border border-border bg-white/50 px-3 text-sm text-text-tertiary transition-all hover:border-border-2 hover:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search anything...</span>
              <kbd className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono text-text-tertiary">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0 hover:bg-surface"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Notification Bell */}
            <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 hover:bg-surface">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />
            </Button>

            <Dropdown
              trigger={
                <button className="flex cursor-pointer items-center gap-2 rounded-lg p-1 transition-all hover:bg-surface/50">
                  <Avatar
                    firstName={user?.firstName}
                    lastName={user?.lastName}
                    src={user?.avatarUrl}
                    size="md"
                  />
                  <div className="hidden text-left lg:block">
                    <p className="text-sm font-medium text-text-primary">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-text-tertiary">{user?.email}</p>
                  </div>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-text-tertiary lg:block" />
                </button>
              }
              items={userMenuItems}
              align="end"
            />
          </div>
        </div>
      </header>
    </>
  )
}