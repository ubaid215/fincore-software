import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reports.api'
import { queryKeys } from '@/shared/lib/query-keys'

export function useDashboardStats(orgId: string) {
  return useQuery({
    queryKey: queryKeys.reports.overview(orgId, 'dashboard'),
    queryFn: () => reportsApi.getDashboardStats(orgId),
    staleTime: 60_000, // 1 minute - dashboard can refresh
    enabled: !!orgId,
  })
}