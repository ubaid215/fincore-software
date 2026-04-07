import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/reports.api'
import { queryKeys } from '@/shared/lib/query-keys'

export function useBalanceSheet(orgId: string, asOfDate: string) {
  return useQuery({
    queryKey: queryKeys.reports.balanceSheet(orgId, asOfDate),
    queryFn: () => reportsApi.getBalanceSheet(orgId, asOfDate),
    staleTime: 0,
    enabled: !!orgId && !!asOfDate,
  })
}