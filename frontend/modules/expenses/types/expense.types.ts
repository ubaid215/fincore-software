import type { ID, Timestamps } from '@/shared/types'

export type ExpenseStatus = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'MANAGER_APPROVED' 
  | 'FINANCE_APPROVED' 
  | 'POSTED' 
  | 'REJECTED'

export interface ExpenseLineItem {
  id?: string
  expenseId?: string
  description: string
  amount: number
  accountId: string
  taxRate: number
  taxAmount?: number
  total?: number
}

export interface ExpenseAttachment {
  id: string
  expenseId: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

export interface Expense extends Timestamps {
  id: ID
  expenseNumber: string
  organizationId: ID
  userId: ID
  userName: string
  category: string
  description: string
  expenseDate: string
  amount: number
  taxAmount: number
  total: number
  status: ExpenseStatus
  currency: string
  receiptUrl?: string
  notes?: string
  rejectionReason?: string
  approvedBy?: ID
  approvedAt?: string
  postedBy?: ID
  postedAt?: string
  lineItems: ExpenseLineItem[]
  attachments: ExpenseAttachment[]
  approvalHistory: ExpenseApprovalHistory[]
}

export interface ExpenseApprovalHistory {
  id: string
  expenseId: string
  status: ExpenseStatus
  userId: ID
  userName: string
  comment?: string
  createdAt: string
}

export interface CreateExpenseRequest {
  category: string
  description: string
  expenseDate: string
  amount: number
  taxRate: number
  currency: string
  notes?: string
  receiptUrl?: string
  lineItems?: Omit<ExpenseLineItem, 'id' | 'expenseId'>[]
}

export interface UpdateExpenseStatusRequest {
  status: ExpenseStatus
  comment?: string
}

export interface ExpenseFilters {
  status?: ExpenseStatus
  category?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}