import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { invoicesApi } from '../api/invoices.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useCreateInvoice(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: Parameters<typeof invoicesApi.create>[1]) =>
      invoicesApi.create(orgId, data),
    onSuccess: (response) => {
      const invoice = response.data
      // Invalidate invoices list cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(orgId),
      })
      toast.success('Invoice created successfully')
      router.push(`/dashboard/${orgId}/invoices/${invoice.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create invoice')
    },
  })
}