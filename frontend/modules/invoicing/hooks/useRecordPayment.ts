import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '../api/invoices.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useRecordPayment(orgId: string, invoiceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof invoicesApi.recordPayment>[2]) =>
      invoicesApi.recordPayment(orgId, invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(orgId, invoiceId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(orgId),
      })
      toast.success('Payment recorded successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record payment')
    },
  })
}