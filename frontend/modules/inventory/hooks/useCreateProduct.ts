import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { inventoryApi } from '../api/inventory.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useCreateProduct(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: Parameters<typeof inventoryApi.createProduct>[1]) =>
      inventoryApi.createProduct(orgId, data),
    onSuccess: (response) => {
      const product = response.data
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(orgId),
      })
      toast.success('Product created successfully')
      router.push(`/dashboard/${orgId}/inventory/${product.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create product')
    },
  })
}