import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reports.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { ReportFilters } from '../types/reports.types'

export function usePnLReport(orgId: string, filters: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.pnl(orgId, JSON.stringify(filters)),
    queryFn: () => reportsApi.getPnL(orgId, filters),
    staleTime: 0, // Always fresh for reports
    enabled: !!orgId && !!filters.dateRange,
  })
}