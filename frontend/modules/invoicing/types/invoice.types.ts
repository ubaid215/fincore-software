import type { ID, Currency, Timestamps } from '@/shared/types'

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID'

export interface InvoiceLineItem {
  id?: string
  invoiceId?: string
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  accountId?: string
  productId?: string
  // Calculated fields
  gross?: number
  discount?: number
  subtotal?: number
  tax?: number
  total?: number
}

export interface Invoice extends Timestamps {
  id: ID
  invoiceNumber: string
  organizationId: ID
  customerId: ID
  customerName: string
  customerEmail?: string
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  currency: Currency
  notes?: string
  terms?: string
  subtotal: number
  taxTotal: number
  total: number
  amountPaid: number
  amountDue: number
  lineItems: InvoiceLineItem[]
  createdAt: string
  updatedAt: string
}

export interface CreateInvoiceRequest {
  customerId: ID
  issueDate: string
  dueDate: string
  currency: Currency
  notes?: string
  terms?: string
  lineItems: Omit<InvoiceLineItem, 'id' | 'invoiceId'>[]
}

export interface UpdateInvoiceRequest extends Partial<CreateInvoiceRequest> {
  id: ID
}

export interface InvoiceFilters {
  status?: InvoiceStatus
  customerId?: ID
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}

export interface RecordPaymentRequest {
  invoiceId: ID
  amount: number
  paymentDate: string
  paymentMethod: string
  reference?: string
  notes?: string
}

export interface SendInvoiceRequest {
  invoiceId: ID
  email?: string
  message?: string
}