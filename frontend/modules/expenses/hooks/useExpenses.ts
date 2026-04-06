import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { expensesApi } from '../api/expenses.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ExpenseFilters } from '../types/expense.types'

export function useExpenses(orgId: string, filters?: ExpenseFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.expenses.list(orgId, filters),
    queryFn: ({ pageParam = 1 }) =>
      expensesApi.list(orgId, { ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000,
    enabled: !!orgId,
  })
}

export function useExpense(orgId: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.expenses.detail(orgId, id!),
    queryFn: () => expensesApi.get(orgId, id!),
    enabled: !!orgId && !!id,
    staleTime: 30_000,
  })
}

export function useExpensesApprovals(orgId: string) {
  return useQuery({
    queryKey: queryKeys.expenses.approvals(orgId),
    queryFn: () => expensesApi.list(orgId, { status: 'SUBMITTED' }),
    staleTime: 15_000, // Shorter stale time for approvals
    enabled: !!orgId,
  })
}