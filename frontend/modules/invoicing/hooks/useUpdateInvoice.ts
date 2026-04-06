import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '../api/invoices.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useUpdateInvoice(orgId: string, invoiceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof invoicesApi.update>[2]) =>
      invoicesApi.update(orgId, invoiceId, data),
    onSuccess: (response) => {
      const invoice = response.data
      // Invalidate both list and detail caches
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(orgId, invoiceId),
      })
      toast.success('Invoice updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update invoice')
    },
  })
}