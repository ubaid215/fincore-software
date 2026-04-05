'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, ChevronDown, LogOut, Settings, Users, Building2 } from 'lucide-react'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import { useWorkspaceStore } from '@/modules/workspace/store/workspace.store'
import { Avatar, Dropdown, Button, CommandPalette } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import { useState } from 'react'

interface TopbarProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

export function Topbar({ onMenuClick, sidebarCollapsed }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  
  const { user, logout } = useAuthStore()
  const { activeOrganization, organizations, setActiveOrganization } = useWorkspaceStore()

  // Extract orgId from pathname
  const orgMatch = pathname?.match(/^\/dashboard\/([a-zA-Z0-9_-]+)/)
  const currentOrgId = orgMatch?.[1]

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const handleOrgSwitch = (orgId: string) => {
    setActiveOrganization(orgId)
    router.push(`/dashboard/${orgId}`)
  }

  const userMenuItems = [
    {
      label: 'Profile Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => currentOrgId && router.push(`/dashboard/${currentOrgId}/settings/profile`),
    },
    {
      label: 'Organization Settings',
      icon: <Building2 className="h-4 w-4" />,
      onClick: () => currentOrgId && router.push(`/dashboard/${currentOrgId}/settings`),
    },
    {
      label: 'Members',
      icon: <Users className="h-4 w-4" />,
      onClick: () => currentOrgId && router.push(`/dashboard/${currentOrgId}/settings/members`),
    },
    { divider: true },
    {
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      onClick: handleLogout,
      destructive: true,
    },
  ]

  const orgSwitcherItems = organizations.map((org) => ({
    label: org.name,
    onClick: () => handleOrgSwitch(org.organizationId),
    icon: <Building2 className="h-4 w-4" />,
  }))

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-30 h-14 bg-white border-b border-border">
        <div className="flex h-full items-center justify-between px-4 lg:px-6">
          {/* Left section */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMenuClick}
              className="lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Org Switcher */}
            {organizations.length > 0 && activeOrganization && (
              <Dropdown
                trigger={
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="max-w-[150px] truncate">{activeOrganization.name}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                }
                items={orgSwitcherItems}
              />
            )}
          </div>

          {/* Center section - Global Search */}
          <div className="hidden md:block">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex h-9 w-80 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-text-tertiary transition-all hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <Search className="h-4 w-4" />
              <span>Search commands...</span>
              <kbd className="ml-auto rounded bg-surface px-1.5 py-0.5 text-xs text-text-tertiary">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommandPalette(true)}
              className="md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Dropdown
              trigger={
                <button className="flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-surface transition-colors">
                  <Avatar
                    firstName={user?.firstName}
                    lastName={user?.lastName}
                    src={user?.avatarUrl}
                    size="md"
                  />
                  <ChevronDown className="hidden h-3.5 w-3.5 text-text-tertiary lg:block" />
                </button>
              }
              items={userMenuItems}
            />
          </div>
        </div>
      </header>

      {/* Command Palette */}
      {currentOrgId && (
        <CommandPalette
          open={showCommandPalette}
          onOpenChange={setShowCommandPalette}
          orgId={currentOrgId}
        />
      )}
    </>
  )
}