import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reports.api'
import { queryKeys } from '@/shared/lib/query-keys'

export function useAgedPayables(orgId: string, asOfDate: string) {
  return useQuery({
    queryKey: [...queryKeys.reports.agedReceiv(orgId, asOfDate), 'payables'],
    queryFn: () => reportsApi.getAgedPayables(orgId, asOfDate),
    staleTime: 0,
    enabled: !!orgId && !!asOfDate,
  })
}