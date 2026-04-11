import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { expensesApi } from '../api/expenses.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/hooks/useToast'

export function useCreateExpense(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: Parameters<typeof expensesApi.create>[1]) =>
      expensesApi.create(orgId, data),
    onSuccess: (response) => {
      const expense = response.data
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.all(orgId),
      })
      toast({ description: 'Expense created successfully', variant: 'success' })
      router.push(`/dashboard/${orgId}/expenses/${expense.id}` as never)
    },
    onError: (error: Error) => {
      toast({ description: error.message || 'Failed to create expense', variant: 'error' })
    },
  })
}