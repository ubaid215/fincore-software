import { apiClient } from '@/shared/lib/api-client'
import type { JournalEntry, CreateJournalEntryRequest, JournalEntryFilters } from '../types/ledger.types'
import type { PaginatedResponse } from '@/shared/types'

export const journalApi = {
  // Get paginated journal entries
  list: (orgId: string, filters?: JournalEntryFilters) =>
    apiClient.get<PaginatedResponse<JournalEntry>>(`/v1/journal`, {
      params: filters,
    }),

  // Get single journal entry
  get: (orgId: string, id: string) =>
    apiClient.get<JournalEntry>(`/v1/journal/${id}`),

  // Create journal entry
  create: (orgId: string, data: CreateJournalEntryRequest) =>
    apiClient.post<JournalEntry>(`/v1/journal`, data),
}