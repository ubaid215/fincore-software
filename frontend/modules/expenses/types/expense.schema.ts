import { z } from 'zod'
import { DEFAULT_CURRENCY } from '@/config/app.config'

export const expenseLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  accountId: z.string().min(1, 'Account is required'),
  taxRate: z.number().min(0).max(100).default(0),
})

export const expenseFormSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  expenseDate: z.string().min(1, 'Expense date is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  taxRate: z.number().min(0).max(100).default(0),
  currency: z.string().default(DEFAULT_CURRENCY),
  notes: z.string().optional(),
  receiptUrl: z.string().optional(),
  lineItems: z.array(expenseLineItemSchema).optional(),
})

export const expenseStatusUpdateSchema = z.object({
  status: z.enum(['SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_APPROVED', 'POSTED', 'REJECTED']),
  comment: z.string().optional(),
})

export type ExpenseFormData = z.infer<typeof expenseFormSchema>
export type ExpenseStatusUpdateData = z.infer<typeof expenseStatusUpdateSchema>