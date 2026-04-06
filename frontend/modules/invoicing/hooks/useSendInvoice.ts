import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '../api/invoices.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useSendInvoice(orgId: string, invoiceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof invoicesApi.send>[2]) =>
      invoicesApi.send(orgId, invoiceId, data),
    onSuccess: () => {
      // Optimistic update handled in component, but we still invalidate
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(orgId, invoiceId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(orgId),
      })
      toast.success('Invoice sent successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invoice')
    },
  })
}