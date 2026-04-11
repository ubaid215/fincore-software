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
    apiClient.get<PaginatedResponse<Expense>>(`/v1/expenses`, {
      params: filters,
    }),

  // Get single expense by ID
  get: (orgId: string, id: string) =>
    apiClient.get<Expense>(`/v1/expenses/${id}`),

  // Create new expense
  create: (orgId: string, data: CreateExpenseRequest) =>
    apiClient.post<Expense>(`/v1/expenses`, data),

  // Update expense
  update: (orgId: string, id: string, data: Partial<CreateExpenseRequest>) =>
    apiClient.patch<Expense>(`/v1/expenses/${id}`, data),

  // Submit for approval
  submit: (orgId: string, id: string) =>
    apiClient.patch<Expense>(`/v1/expenses/${id}/submit`, {}),

  // Approve expense (Manager)
  approveManager: (orgId: string, id: string, note?: string) =>
    apiClient.patch<Expense>(`/v1/expenses/${id}/approve/manager`, { note }),

  // Approve expense (Finance)
  approveFinance: (orgId: string, id: string, note?: string) =>
    apiClient.patch<Expense>(`/v1/expenses/${id}/approve/finance`, { note }),

  // Reject expense
  reject: (orgId: string, id: string, rejectionNote: string) =>
    apiClient.patch<Expense>(`/v1/expenses/${id}/reject`, { rejectionNote }),

  // Post to ledger
  post: (orgId: string, id: string, apAccountId: string) =>
    apiClient.patch<Expense>(`/v1/expenses/${id}/post`, { apAccountId }),

  // Upload receipt
  uploadReceipt: async (orgId: string, id: string, file: File) => {
    // 1. Initiate upload
    const initResponse = await apiClient.post<{ data: { uploadUrl: string; receiptId: string } }>(
      `/v1/expenses/${id}/receipts/initiate`,
      {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }
    )
    
    // Extract nested data wrapper from backend TransformInterceptor
    const { uploadUrl, receiptId } = (initResponse as any).data

    // 2. Upload to S3 directly (using native fetch to avoid axios interceptor auth headers on S3 URL)
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    // 3. Confirm upload
    return apiClient.post<{ data: any }>(`/v1/expenses/${id}/receipts/${receiptId}/confirm`, {})
  },
}