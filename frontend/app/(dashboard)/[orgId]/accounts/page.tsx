'use client'

import { useParams } from 'next/navigation'
import { useAccountTree } from '@/modules/ledger'
import { AccountTree } from '@/modules/ledger'
import { PageHeader, Card } from '@/shared/ui'

export default function AccountsPage() {
  const params = useParams()
  const orgId = params.orgId as string

  const { data: accounts, isLoading } = useAccountTree(orgId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        description="Manage your organization's chart of accounts"
      />

      <div className="mt-6">
        <Card className="p-4">
          <AccountTree accounts={accounts?.data ?? []} />
        </Card>
      </div>
    </div>
  )
}