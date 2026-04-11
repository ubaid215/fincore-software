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
    apiClient.get<PaginatedResponse<Invoice>>(`/v1/invoices`, {
      params: filters,
    }),

  // Get single invoice by ID
  get: (orgId: string, id: string) =>
    apiClient.get<Invoice>(`/v1/invoices/${id}`),

  // Create new invoice
  create: (orgId: string, data: CreateInvoiceRequest) =>
    apiClient.post<Invoice>(`/v1/invoices`, data),

  // Update existing invoice
  update: (orgId: string, id: string, data: UpdateInvoiceRequest) =>
    apiClient.patch<Invoice>(`/v1/invoices/${id}`, data),

  // Send invoice via email
  send: (orgId: string, id: string, data: SendInvoiceRequest) =>
    apiClient.post<{ success: boolean }>(`/v1/invoices/${id}/send`, data),

  // Record payment on invoice
  recordPayment: (orgId: string, id: string, data: RecordPaymentRequest) =>
    apiClient.post<Invoice>(`/v1/invoices/${id}/payments`, data),

  // Void invoice
  void: (orgId: string, id: string, reason?: string) =>
    apiClient.post<Invoice>(`/v1/invoices/${id}/void`, { reason }),

  // Download PDF
  downloadPdf: (orgId: string, id: string) =>
    apiClient.get<Blob>(`/v1/invoices/${id}/pdf`, {
      responseType: 'blob',
    }),
}