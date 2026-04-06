'use client'

import { useRouter } from 'next/navigation'
import { Building2, Check } from 'lucide-react'
import { useAuthStore } from '@/modules/auth'
import { useWorkspaceStore } from '../store/workspace.store'
import { Button, Card } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'

export function OrgSelector() {
  const router = useRouter()
  const { userMemberships } = useAuthStore()
  const { activeOrganizationId, setActiveOrganizationId } = useWorkspaceStore()

  const handleSelectOrg = (orgId: string) => {
    setActiveOrganizationId(orgId)
    router.push(`/dashboard/${orgId}`)
  }

  if (!userMemberships || userMemberships.length === 0) {
    return (
      <Card className="max-w-md w-full p-8 text-center">
        <Building2 className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">No organizations</h2>
        <p className="text-sm text-text-tertiary mb-6">
          You haven't been added to any organization yet.
        </p>
        <Button onClick={() => router.push('/logout')}>Sign out</Button>
      </Card>
    )
  }

  return (
    <Card className="max-w-md w-full p-8">
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Select Organization</h1>
        <p className="text-sm text-text-tertiary mt-1">Choose an organization to continue</p>
      </div>
      <div className="space-y-2">
        {userMemberships.map((membership) => (
          <button
            key={membership.organizationId}
            onClick={() => handleSelectOrg(membership.organizationId)}
            className={cn(
              'w-full flex items-center justify-between rounded-lg border p-4 text-left transition-all',
              activeOrganizationId === membership.organizationId
                ? 'border-accent bg-accent-subtle'
                : 'border-border hover:border-accent hover:bg-accent-subtle'
            )}
          >
            <div>
              <p className="font-medium text-text-primary">{membership.organizationName}</p>
              <p className="text-xs text-text-tertiary mt-0.5 capitalize">
                {membership.role.toLowerCase()} access
              </p>
            </div>
            {activeOrganizationId === membership.organizationId && (
              <Check className="h-5 w-5 text-accent" />
            )}
          </button>
        ))}
      </div>
    </Card>
  )
}