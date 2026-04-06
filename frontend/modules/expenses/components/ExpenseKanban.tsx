'use client'

import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import { Badge, Card } from '@/shared/ui'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import type { Expense, ExpenseStatus } from '../types/expense.types'

interface ExpenseKanbanProps {
  expenses: Expense[]
  onDragEnd?: (expenseId: string, newStatus: ExpenseStatus) => void
}

const columns: { id: ExpenseStatus; title: string }[] = [
  { id: 'DRAFT', title: 'Draft' },
  { id: 'SUBMITTED', title: 'Submitted' },
  { id: 'MANAGER_APPROVED', title: 'Manager Approved' },
  { id: 'FINANCE_APPROVED', title: 'Finance Approved' },
  { id: 'POSTED', title: 'Posted' },
  { id: 'REJECTED', title: 'Rejected' },
]

export function ExpenseKanban({ expenses, onDragEnd }: ExpenseKanbanProps) {
  const router = useRouter()

  const getExpensesByStatus = (status: ExpenseStatus) => {
    return expenses.filter(e => e.status === status)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnExpenses = getExpensesByStatus(column.id)
        
        return (
          <div key={column.id} className="min-w-[280px] flex-1">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-primary">{column.title}</h3>
              <Badge variant="default">{columnExpenses.length}</Badge>
            </div>
            <div className="space-y-3">
              {columnExpenses.map((expense) => (
                <Card
                  key={expense.id}
                  className="cursor-pointer p-3 transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/expenses/${expense.id}`)}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-text-tertiary">
                      {expense.expenseNumber}
                    </span>
                    <ExpenseStatusBadge status={expense.status} />
                  </div>
                  <p className="text-sm font-medium text-text-primary line-clamp-1">
                    {expense.description}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {expense.category} • {formatDate(expense.expenseDate)}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">
                      {expense.userName}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {formatCurrency(expense.total, expense.currency)}
                    </span>
                  </div>
                </Card>
              ))}
              {columnExpenses.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-text-tertiary">No expenses</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}