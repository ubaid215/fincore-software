'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar, Sidebar } from '@/components'
import { useAuthStore } from '@/modules/auth'
import { cn } from '@/shared/utils/cn'

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { activeOrganizationId, userMemberships } = useAuthStore()

  // Check if user has access to this org
  useEffect(() => {
    const hasAccess = userMemberships?.some((m) => m.organizationId === orgId)
    if (userMemberships && !hasAccess) {
      router.push('/dashboard/select')
    }
  }, [orgId, userMemberships, router])

  // Sync active org
  useEffect(() => {
    if (activeOrganizationId !== orgId && userMemberships) {
      const hasOrg = userMemberships.some((m) => m.organizationId === orgId)
      if (hasOrg) {
        useAuthStore.getState().setActiveOrganizationId(orgId)
        localStorage.setItem('fincore:activeOrgId', orgId)
      }
    }
  }, [orgId, activeOrganizationId, userMemberships])

  return (
    <div
      className={cn(
        'min-h-screen bg-canvas transition-all duration-300',
        sidebarCollapsed ? 'pl-16' : 'pl-64',
      )}
    >
      <Topbar onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)} sidebarCollapsed={sidebarCollapsed} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} orgId={orgId} />
      <main className="pt-14">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}