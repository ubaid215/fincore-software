'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Crown, Shield, User, Eye, Trash2 } from 'lucide-react'
import { DataGrid, Button, Dropdown, Badge, Guard } from '@/shared/ui'
import type { Role } from '@/shared/types'

export interface Member {
  id: string
  name: string
  email: string
  role: Role
  joinedAt: string
}

const columnHelper = createColumnHelper<Member>()

interface MemberTableProps {
  data: Member[]
  isLoading?: boolean
  currentUserRole: Role
  onRemove?: (member: Member) => void
  onChangeRole?: (member: Member, newRole: Role) => void
}

const roleLabels: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  MANAGER: 'Manager',
  VIEWER: 'Viewer',
}

const roleIcons: Record<Role, React.ReactNode> = {
  OWNER: <Crown className="h-4 w-4 text-warning" />,
  ADMIN: <Shield className="h-4 w-4 text-accent" />,
  ACCOUNTANT: <User className="h-4 w-4" />,
  MANAGER: <User className="h-4 w-4" />,
  VIEWER: <Eye className="h-4 w-4" />,
}

export function MemberTable({ data, isLoading, currentUserRole, onRemove, onChangeRole }: MemberTableProps) {
  const canManage = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN'

  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2">
            {info.getValue().charAt(0)}
          </div>
          <span className="font-medium text-text-primary">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => {
        const role = info.getValue()
        return (
          <div className="flex items-center gap-1.5">
            {roleIcons[role]}
            <span>{roleLabels[role]}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('joinedAt', {
      header: 'Joined',
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const member = info.row.original
        const isSelf = member.email === 'current-user@example.com' // TODO: Get from auth
        const isOwner = member.role === 'OWNER'
        
        if (!canManage || isSelf || isOwner) return null
        
        return (
          <Dropdown
            trigger={
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
            items={[
              {
                label: 'Change to Admin',
                onClick: () => onChangeRole?.(member, 'ADMIN'),
              },
              {
                label: 'Change to Accountant',
                onClick: () => onChangeRole?.(member, 'ACCOUNTANT'),
              },
              {
                label: 'Change to Manager',
                onClick: () => onChangeRole?.(member, 'MANAGER'),
              },
              {
                label: 'Change to Viewer',
                onClick: () => onChangeRole?.(member, 'VIEWER'),
              },
              {
                  divider: true,
                  label: ''
              },
              {
                label: 'Remove Member',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => onRemove?.(member),
                destructive: true,
              },
            ]}
          />
        )
      },
    }),
  ]

  return (
    <DataGrid
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyState={
        <div className="py-12 text-center">
          <p className="text-text-tertiary">No members found</p>
        </div>
      }
    />
  )
}