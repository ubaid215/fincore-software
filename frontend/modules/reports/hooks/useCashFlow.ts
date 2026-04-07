import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reports.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ReportFilters } from '../types/reports.types'

export function useCashFlow(orgId: string, filters: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.cashFlow(orgId, JSON.stringify(filters)),
    queryFn: () => reportsApi.getCashFlow(orgId, filters),
    staleTime: 0,
    enabled: !!orgId && !!filters.dateRange,
  })
}