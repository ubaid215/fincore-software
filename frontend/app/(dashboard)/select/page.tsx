'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/modules/auth'
import { Card, Button } from '@/shared/ui'
import { Building2 } from 'lucide-react'

export default function SelectOrganizationPage() {
  const router = useRouter()
  const { userMemberships, setActiveOrganizationId } = useAuthStore()

  const handleSelectOrg = (orgId: string) => {
    setActiveOrganizationId(orgId)
    localStorage.setItem('fincore:activeOrgId', orgId)
    router.push(`/dashboard/${orgId}`)
  }

  if (!userMemberships || userMemberships.length === 0) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Building2 className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">No organizations</h2>
          <p className="text-sm text-text-tertiary mb-6">
            You haven&apos;t been added to any organization yet.
          </p>
          <Button onClick={() => router.push('/logout')}>Sign out</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
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
              className="w-full flex items-center justify-between rounded-lg border border-border p-4 text-left transition-all hover:border-accent hover:bg-accent-subtle"
            >
              <div>
                <p className="font-medium text-text-primary">{membership.organizationName}</p>
                <p className="text-xs text-text-tertiary mt-0.5 capitalize">
                  {membership.role.toLowerCase()} access
                </p>
              </div>
              <Building2 className="h-5 w-5 text-text-tertiary" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}