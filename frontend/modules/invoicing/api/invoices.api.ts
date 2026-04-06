import { apiClient } from '@/shared/lib/api-client'
import type {
  Invoice,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceFilters,
  RecordPaymentRequest,
  SendInvoiceRequest,
} from '../types/invoice.types'
import type { PaginatedResponse } from '@/shared/types'

export const invoicesApi = {
  // Get paginated list of invoices
  list: (orgId: string, filters?: InvoiceFilters) =>
    apiClient.get<PaginatedResponse<Invoice>>(`/organizations/${orgId}/invoices`, {
      params: filters,
    }),

  // Get single invoice by ID
  get: (orgId: string, id: string) =>
    apiClient.get<Invoice>(`/organizations/${orgId}/invoices/${id}`),

  // Create new invoice
  create: (orgId: string, data: CreateInvoiceRequest) =>
    apiClient.post<Invoice>(`/organizations/${orgId}/invoices`, data),

  // Update existing invoice
  update: (orgId: string, id: string, data: UpdateInvoiceRequest) =>
    apiClient.patch<Invoice>(`/organizations/${orgId}/invoices/${id}`, data),

  // Send invoice via email
  send: (orgId: string, id: string, data: SendInvoiceRequest) =>
    apiClient.post<{ success: boolean }>(`/organizations/${orgId}/invoices/${id}/send`, data),

  // Record payment on invoice
  recordPayment: (orgId: string, id: string, data: RecordPaymentRequest) =>
    apiClient.post<Invoice>(`/organizations/${orgId}/invoices/${id}/payments`, data),

  // Void invoice
  void: (orgId: string, id: string, reason?: string) =>
    apiClient.post<Invoice>(`/organizations/${orgId}/invoices/${id}/void`, { reason }),

  // Download PDF
  downloadPdf: (orgId: string, id: string) =>
    apiClient.get<Blob>(`/organizations/${orgId}/invoices/${id}/pdf`, {
      responseType: 'blob',
    }),
}