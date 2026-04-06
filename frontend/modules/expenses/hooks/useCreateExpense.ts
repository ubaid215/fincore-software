import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { expensesApi } from '../api/expenses.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui/'

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
      toast.success('Expense created successfully')
      router.push(`/dashboard/${orgId}/expenses/${expense.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create expense')
    },
  })
}