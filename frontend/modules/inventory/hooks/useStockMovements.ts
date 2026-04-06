import { useInfiniteQuery } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventory.api'
import { queryKeys } from '@/shared/lib/query-keys'

export function useStockMovements(orgId: string, productId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.movements(orgId, productId),
    queryFn: ({ pageParam = 1 }) =>
      inventoryApi.getStockMovements(orgId, productId, pageParam, 50),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000,
    enabled: !!orgId && !!productId,
  })
}

export function useAdjustStock(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof inventoryApi.adjustStock>[1]) =>
      inventoryApi.adjustStock(orgId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.movements(orgId, variables.productId),
      })
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all(orgId), 'low-stock'],
      })
      toast.success('Stock adjusted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to adjust stock')
    },
  })
}