import { apiClient } from '@/shared/lib/api-client'
import type {
  Expense,
  CreateExpenseRequest,
  UpdateExpenseStatusRequest,
  ExpenseFilters,
} from '../types/expense.types'
import type { PaginatedResponse } from '@/shared/types'

export const expensesApi = {
  // Get paginated list of expenses
  list: (orgId: string, filters?: ExpenseFilters) =>
    apiClient.get<PaginatedResponse<Expense>>(`/organizations/${orgId}/expenses`, {
      params: filters,
    }),

  // Get single expense by ID
  get: (orgId: string, id: string) =>
    apiClient.get<Expense>(`/organizations/${orgId}/expenses/${id}`),

  // Create new expense
  create: (orgId: string, data: CreateExpenseRequest) =>
    apiClient.post<Expense>(`/organizations/${orgId}/expenses`, data),

  // Update expense
  update: (orgId: string, id: string, data: Partial<CreateExpenseRequest>) =>
    apiClient.patch<Expense>(`/organizations/${orgId}/expenses/${id}`, data),

  // Submit for approval
  submit: (orgId: string, id: string) =>
    apiClient.post<Expense>(`/organizations/${orgId}/expenses/${id}/submit`, {}),

  // Approve expense (Manager)
  approveManager: (orgId: string, id: string, comment?: string) =>
    apiClient.post<Expense>(`/organizations/${orgId}/expenses/${id}/approve-manager`, { comment }),

  // Approve expense (Finance)
  approveFinance: (orgId: string, id: string, comment?: string) =>
    apiClient.post<Expense>(`/organizations/${orgId}/expenses/${id}/approve-finance`, { comment }),

  // Reject expense
  reject: (orgId: string, id: string, comment: string) =>
    apiClient.post<Expense>(`/organizations/${orgId}/expenses/${id}/reject`, { comment }),

  // Post to ledger
  post: (orgId: string, id: string) =>
    apiClient.post<Expense>(`/organizations/${orgId}/expenses/${id}/post`, {}),

  // Upload receipt
  uploadReceipt: (orgId: string, id: string, file: File) => {
    const formData = new FormData()
    formData.append('receipt', file)
    return apiClient.post<{ receiptUrl: string }>(
      `/organizations/${orgId}/expenses/${id}/receipt`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
  },
}