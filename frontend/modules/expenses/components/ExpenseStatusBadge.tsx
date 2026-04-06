'use client'

import { Badge } from '@/shared/ui'
import type { ExpenseStatus } from '../types/expense.types'

interface ExpenseStatusBadgeProps {
  status: ExpenseStatus
}

const statusLabels: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  MANAGER_APPROVED: 'Manager Approved',
  FINANCE_APPROVED: 'Finance Approved',
  POSTED: 'Posted',
  REJECTED: 'Rejected',
}

const statusVariants: Record<ExpenseStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'draft'> = {
  DRAFT: 'draft',
  SUBMITTED: 'info',
  MANAGER_APPROVED: 'warning',
  FINANCE_APPROVED: 'warning',
  POSTED: 'success',
  REJECTED: 'danger',
}

export function ExpenseStatusBadge({ status }: ExpenseStatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]}>
      {statusLabels[status]}
    </Badge>
  )
}