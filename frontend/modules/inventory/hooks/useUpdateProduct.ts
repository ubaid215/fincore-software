import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventory.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useUpdateProduct(orgId: string, productId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof inventoryApi.updateProduct>[2]) =>
      inventoryApi.updateProduct(orgId, productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(orgId, productId),
      })
      toast.success('Product updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update product')
    },
  })
}