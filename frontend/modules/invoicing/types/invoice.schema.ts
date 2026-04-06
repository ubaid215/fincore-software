import { z } from 'zod'
import { DEFAULT_CURRENCY, CURRENCIES } from '@/config/app.config'

export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  accountId: z.string().optional(),
  productId: z.string().optional(),
})

export const invoiceFormSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  currency: z.enum(CURRENCIES.map(c => c.code) as [string, ...string[]]).default(DEFAULT_CURRENCY),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const sendInvoiceSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  message: z.string().optional(),
})

export type InvoiceFormData = z.infer<typeof invoiceFormSchema>
export type RecordPaymentFormData = z.infer<typeof recordPaymentSchema>
export type SendInvoiceFormData = z.infer<typeof sendInvoiceSchema>