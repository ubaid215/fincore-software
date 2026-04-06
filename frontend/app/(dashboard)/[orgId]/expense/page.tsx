'use client'

import { useParams, useRouter } from 'next/navigation'
import { Plus, LayoutGrid, Table } from 'lucide-react'
import { useExpenses, useExpenseStore } from '@/modules/expenses'
import { ExpenseTable, ExpenseKanban } from '@/modules/expenses'
import { Button, PageHeader } from '@/shared/ui'

export default function ExpensesPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const { viewMode, setViewMode } = useExpenseStore()

  const { data, isLoading } = useExpenses(orgId)
  const expenses = data?.pages.flatMap(page => page.data.data) ?? []

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track and manage all expenses"
        actions={
          <div className="flex gap-3">
            <div className="flex rounded-md border border-border">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'px-2 py-1.5 text-sm transition-colors',
                  viewMode === 'table'
                    ? 'bg-accent text-white'
                    : 'text-text-tertiary hover:text-text-primary'
                )}
              >
                <Table className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'px-2 py-1.5 text-sm transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-accent text-white'
                    : 'text-text-tertiary hover:text-text-primary'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => router.push(`/dashboard/${orgId}/expenses/new`)}>
              <Plus className="mr-2 h-4 w-4" />
              New Expense
            </Button>
          </div>
        }
      />

      <div className="mt-6">
        {viewMode === 'table' ? (
          <ExpenseTable data={expenses} isLoading={isLoading} />
        ) : (
          <ExpenseKanban expenses={expenses} />
        )}
      </div>
    </div>
  )
}