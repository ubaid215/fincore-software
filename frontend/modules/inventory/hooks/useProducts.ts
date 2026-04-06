import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventory.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ProductFilters } from '../types/inventory.types'

export function useProducts(orgId: string, filters?: ProductFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.list(orgId, filters),
    queryFn: ({ pageParam = 1 }) =>
      inventoryApi.listProducts(orgId, { ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000,
    enabled: !!orgId,
  })
}

export function useProduct(orgId: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(orgId, id!),
    queryFn: () => inventoryApi.getProduct(orgId, id!),
    enabled: !!orgId && !!id,
    staleTime: 30_000,
  })
}

export function useLowStockProducts(orgId: string) {
  return useQuery({
    queryKey: [...queryKeys.products.all(orgId), 'low-stock'],
    queryFn: () => inventoryApi.getLowStockProducts(orgId),
    staleTime: 60_000, // 1 minute
    enabled: !!orgId,
    refetchInterval: 60_000, // Refetch every minute
  })
}

export function useStockSummary(orgId: string) {
  return useQuery({
    queryKey: [...queryKeys.products.all(orgId), 'summary'],
    queryFn: () => inventoryApi.getStockSummary(orgId),
    staleTime: 60_000,
    enabled: !!orgId,
  })
}