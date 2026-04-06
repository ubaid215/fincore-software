import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { journalApi } from '../api/journal.api'
import { queryKeys } from '@/shared/lib/query-keys'
import type { JournalEntryFilters } from '../types/ledger.types'

export function useJournalEntries(orgId: string, filters?: JournalEntryFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.journal.list(orgId, filters),
    queryFn: ({ pageParam = 1 }) =>
      journalApi.list(orgId, { ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000,
    enabled: !!orgId,
  })
}

export function useJournalEntry(orgId: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.journal.detail(orgId, id!),
    queryFn: () => journalApi.get(orgId, id!),
    enabled: !!orgId && !!id,
    staleTime: 30_000,
  })
}