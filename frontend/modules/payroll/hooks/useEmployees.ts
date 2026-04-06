import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { payrollApi } from '../api/payroll.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { EmployeeFilters } from '../types/payroll.types'

export function useEmployees(orgId: string, filters?: EmployeeFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.employees.list(orgId),
    queryFn: ({ pageParam = 1 }) =>
      payrollApi.listEmployees(orgId, { ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 60_000,
    enabled: !!orgId,
  })
}

export function useEmployee(orgId: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.detail(orgId, id!),
    queryFn: () => payrollApi.getEmployee(orgId, id!),
    enabled: !!orgId && !!id,
    staleTime: 60_000,
  })
}