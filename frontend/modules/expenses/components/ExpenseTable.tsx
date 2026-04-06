'use client'

import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Eye, CheckCircle, XCircle, FileText } from 'lucide-react'
import { DataGrid, Button, Dropdown, Guard } from '@/shared/ui'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import type { Expense } from '../types/expense.types'

const columnHelper = createColumnHelper<Expense>()

interface ExpenseTableProps {
  data: Expense[]
  isLoading?: boolean
  onApprove?: (expense: Expense) => void
  onReject?: (expense: Expense) => void
  onView?: (expense: Expense) => void
}

export function ExpenseTable({ data, isLoading, onApprove, onReject, onView }: ExpenseTableProps) {
  const router = useRouter()

  const columns = [
    columnHelper.accessor('expenseNumber', {
      header: 'Expense #',
      cell: (info) => (
        <span className="font-mono text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('userName', {
      header: 'Submitted By',
      cell: (info) => (
        <span className="text-text-primary">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => (
        <span className="line-clamp-1 max-w-[200px]">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('expenseDate', {
      header: 'Date',
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor('total', {
      header: 'Amount',
      cell: (info) => formatCurrency(info.getValue(), info.row.original.currency),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <ExpenseStatusBadge status={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const expense = info.row.original
        const canApprove = expense.status === 'SUBMITTED' || expense.status === 'MANAGER_APPROVED'
        const canReject = expense.status === 'SUBMITTED' || expense.status === 'MANAGER_APPROVED'

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/expenses/${expense.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
              items={[
                {
                  label: 'View Details',
                  icon: <Eye className="h-4 w-4" />,
                  onClick: () => router.push(`/expenses/${expense.id}`),
                },
                ...(canApprove ? [{
                  label: 'Approve',
                  icon: <CheckCircle className="h-4 w-4" />,
                  onClick: () => onApprove?.(expense),
                }] : []),
                ...(canReject ? [{
                  label: 'Reject',
                  icon: <XCircle className="h-4 w-4" />,
                  onClick: () => onReject?.(expense),
                  destructive: true,
                }] : []),
                {
                  label: 'View Receipt',
                  icon: <FileText className="h-4 w-4" />,
                  onClick: () => window.open(expense.receiptUrl, '_blank'),
                  disabled: !expense.receiptUrl,
                },
              ]}
            />
          </div>
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
          <p className="text-text-tertiary">No expenses found</p>
        </div>
      }
    />
  )
}