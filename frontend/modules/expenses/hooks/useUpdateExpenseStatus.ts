import { useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesApi } from '../api/expenses.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/hooks/useToast'
import type { ExpenseStatus } from '../types/expense.types'

type StatusAction = 
  | { type: 'submit' }
  | { type: 'approveManager'; comment?: string }
  | { type: 'approveFinance'; comment?: string }
  | { type: 'reject'; comment: string }
  | { type: 'post'; apAccountId: string }

export function useUpdateExpenseStatus(orgId: string, expenseId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: StatusAction) => {
      switch (action.type) {
        case 'submit':
          return expensesApi.submit(orgId, expenseId)
        case 'approveManager':
          return expensesApi.approveManager(orgId, expenseId, action.comment)
        case 'approveFinance':
          return expensesApi.approveFinance(orgId, expenseId, action.comment)
        case 'reject':
          return expensesApi.reject(orgId, expenseId, action.comment)
        case 'post':
          return expensesApi.post(orgId, expenseId, action.apAccountId)
      }
    },
    onMutate: async (action) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.expenses.detail(orgId, expenseId),
      })

      // Snapshot previous value
      const previousExpense = queryClient.getQueryData(
        queryKeys.expenses.detail(orgId, expenseId)
      )

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.expenses.detail(orgId, expenseId),
        (old: any) => {
          if (!old) return old
          let newStatus: ExpenseStatus
          switch (action.type) {
            case 'submit':
              newStatus = 'SUBMITTED'
              break
            case 'approveManager':
              newStatus = 'MANAGER_APPROVED'
              break
            case 'approveFinance':
              newStatus = 'FINANCE_APPROVED'
              break
            case 'reject':
              newStatus = 'REJECTED'
              break
            case 'post':
              newStatus = 'POSTED'
              break
          }
          return { ...old, data: { ...old.data, status: newStatus } }
        }
      )

      return { previousExpense }
    },
    onSuccess: (response, action) => {
      const statusMessages: Record<string, string> = {
        submit: 'Expense submitted for approval',
        approveManager: 'Expense approved by manager',
        approveFinance: 'Expense approved by finance',
        reject: 'Expense rejected',
        post: 'Expense posted to ledger',
      }
      toast({ description: statusMessages[action.type] || 'Status updated', variant: 'success' })
      
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.detail(orgId, expenseId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.approvals(orgId),
      })
    },
    onError: (error, action, context) => {
      // Rollback on error
      if (context?.previousExpense) {
        queryClient.setQueryData(
          queryKeys.expenses.detail(orgId, expenseId),
          context.previousExpense
        )
      }
      toast({ description: error.message || 'Failed to update expense status', variant: 'error' })
    },
  })
}