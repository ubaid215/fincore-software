'use client'

import { useParams, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useJournalEntries } from '@/modules/ledger'
import { JournalTable } from '@/modules/ledger'
import { Button, PageHeader } from '@/shared/ui'

export default function JournalPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data, isLoading } = useJournalEntries(orgId)
  const entries = data?.pages.flatMap(page => page.data.data) ?? []

  return (
    <div>
      <PageHeader
        title="Journal Entries"
        description="View all general ledger journal entries"
        actions={
          <Button onClick={() => router.push(`/dashboard/${orgId}/journal/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            New Journal Entry
          </Button>
        }
      />

      <div className="mt-6">
        <JournalTable data={entries} isLoading={isLoading} />
      </div>
    </div>
  )
}