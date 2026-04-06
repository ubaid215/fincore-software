import { useInfiniteQuery } from '@tanstack/react-query'
import { invoicesApi } from '../api/invoices.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { InvoiceFilters } from '../types/invoice.types'

export function useInvoices(orgId: string, filters?: InvoiceFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.invoices.list(orgId, filters),
    queryFn: ({ pageParam = 1 }) =>
      invoicesApi.list(orgId, { ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000, // 30 seconds
    enabled: !!orgId,
  })
}