import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { invoicesApi } from '../api/invoices.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useVoidInvoice(orgId: string, invoiceId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (reason?: string) => invoicesApi.void(orgId, invoiceId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(orgId, invoiceId),
      })
      toast.success('Invoice voided successfully')
      router.push(`/dashboard/${orgId}/invoices`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to void invoice')
    },
  })
}