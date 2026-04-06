'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { MemberTable, InviteMemberModal } from '@/modules/workspace'
import { useAuthStore } from '@/modules/auth'
import { Button, PageHeader } from '@/shared/ui'

export default function MembersPage() {
  const params = useParams()
  const orgId = params.orgId as string
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const { userMemberships } = useAuthStore()

  // TODO: Fetch members from API
  const mockMembers = [
    { id: '1', name: 'John Doe', email: 'john@acme.com', role: 'OWNER', joinedAt: '2024-01-15' },
    { id: '2', name: 'Jane Smith', email: 'jane@acme.com', role: 'ADMIN', joinedAt: '2024-02-20' },
    { id: '3', name: 'Bob Wilson', email: 'bob@acme.com', role: 'VIEWER', joinedAt: '2024-03-10' },
  ]

  const currentUserRole = userMemberships?.find(m => m.organizationId === orgId)?.role || 'VIEWER'

  const handleInvite = async (data: any) => {
    console.log('Invite:', data)
    // TODO: API call to invite member
  }

  return (
    <div>
      <PageHeader
        title="Team Members"
        description="Manage who has access to this organization"
        actions={
          <Button onClick={() => setInviteModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        }
      />

      <div className="mt-6">
        <MemberTable
          data={mockMembers}
          currentUserRole={currentUserRole}
          onRemove={(member) => console.log('Remove:', member)}
          onChangeRole={(member, role) => console.log('Change role:', member, role)}
        />
      </div>

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={handleInvite}
      />
    </div>
  )
}