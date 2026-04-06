import { apiClient } from '@/shared/lib/api-client'
import type { Account } from '../types/ledger.types'

export const accountsApi = {
  // Get chart of accounts
  list: (orgId: string) =>
    apiClient.get<Account[]>(`/organizations/${orgId}/accounts`),

  // Get account by ID
  get: (orgId: string, id: string) =>
    apiClient.get<Account>(`/organizations/${orgId}/accounts/${id}`),

  // Get account tree (hierarchical)
  tree: (orgId: string) =>
    apiClient.get<Account[]>(`/organizations/${orgId}/accounts/tree`),

  // Create account
  create: (orgId: string, data: Partial<Account>) =>
    apiClient.post<Account>(`/organizations/${orgId}/accounts`, data),

  // Update account
  update: (orgId: string, id: string, data: Partial<Account>) =>
    apiClient.patch<Account>(`/organizations/${orgId}/accounts/${id}`, data),
}