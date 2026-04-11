import { apiClient } from '@/shared/lib/api-client'
import type { Account } from '../types/ledger.types'

export const accountsApi = {
  // Get chart of accounts
  list: (orgId: string) =>
    apiClient.get<Account[]>(`/v1/accounts`),

  // Get account by ID
  get: (orgId: string, id: string) =>
    apiClient.get<Account>(`/v1/accounts/${id}`),

  // Get account tree (hierarchical)
  tree: (orgId: string) =>
    apiClient.get<Account[]>(`/v1/accounts/tree`),

  // Create account
  create: (orgId: string, data: Partial<Account>) =>
    apiClient.post<Account>(`/v1/accounts`, data),

  // Update account
  update: (orgId: string, id: string, data: Partial<Account>) =>
    apiClient.patch<Account>(`/v1/accounts/${id}`, data),
}