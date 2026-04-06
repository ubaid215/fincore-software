import { safeMultiply, safeAdd } from '@/shared/utils/currency'
import type { InvoiceLineItem } from '../types/invoice.types'

export interface CalculatedLineItem extends InvoiceLineItem {
  gross: number
  discount: number
  subtotal: number
  tax: number
  total: number
}

/**
 * Calculate totals for a single line item
 */
export function calculateLineTotals(line: Partial<InvoiceLineItem>): CalculatedLineItem {
  const quantity = line.quantity || 0
  const unitPrice = line.unitPrice || 0
  const discountPercent = line.discountPercent || 0
  const taxRate = line.taxRate || 0

  const gross = safeMultiply(quantity, unitPrice)
  const discount = parseFloat((gross * (discountPercent / 100)).toFixed(2))
  const subtotal = parseFloat((gross - discount).toFixed(2))
  const tax = parseFloat((subtotal * (taxRate / 100)).toFixed(2))
  const total = parseFloat((subtotal + tax).toFixed(2))

  return {
    ...line,
    description: line.description || '',
    quantity,
    unitPrice,
    discountPercent,
    taxRate,
    gross,
    discount,
    subtotal,
    tax,
    total,
  }
}

/**
 * Calculate invoice-level totals from line items
 */
export function calculateInvoiceTotals(
  lines: Array<{ subtotal: number; tax: number; total: number }>
): {
  subtotal: number
  taxTotal: number
  total: number
} {
  const subtotal = safeAdd(...lines.map(l => l.subtotal))
  const taxTotal = safeAdd(...lines.map(l => l.tax))
  const total = safeAdd(...lines.map(l => l.total))

  return { subtotal, taxTotal, total }
}

/**
 * Calculate amount due (total - paid)
 */
export function calculateAmountDue(total: number, amountPaid: number): number {
  return Math.max(0, parseFloat((total - amountPaid).toFixed(2)))
}

/**
 * Check if invoice is overdue based on due date and status
 */
export function isInvoiceOverdue(dueDate: string, status: string): boolean {
  if (status !== 'SENT') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return due < today
}

/**
 * Get invoice status badge variant
 */
export function getInvoiceStatusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'draft' {
  switch (status) {
    case 'DRAFT':
      return 'draft'
    case 'SENT':
      return 'info'
    case 'PAID':
      return 'success'
    case 'OVERDUE':
      return 'danger'
    case 'VOID':
      return 'default'
    default:
      return 'default'
  }
}

/**
 * Format invoice number with prefix
 */
export function formatInvoiceNumber(number: string | number, prefix: string = 'INV-'): string {
  return `${prefix}${String(number).padStart(6, '0')}`
}

/**
 * Validate line items before submission
 */
export function validateLineItems(lines: Partial<InvoiceLineItem>[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  lines.forEach((line, index) => {
    if (!line.description || line.description.trim() === '') {
      errors.push(`Line item ${index + 1}: Description is required`)
    }
    if ((line.quantity || 0) <= 0) {
      errors.push(`Line item ${index + 1}: Quantity must be greater than 0`)
    }
    if ((line.unitPrice || 0) < 0) {
      errors.push(`Line item ${index + 1}: Unit price cannot be negative`)
    }
    if ((line.discountPercent || 0) < 0 || (line.discountPercent || 0) > 100) {
      errors.push(`Line item ${index + 1}: Discount must be between 0 and 100`)
    }
    if ((line.taxRate || 0) < 0 || (line.taxRate || 0) > 100) {
      errors.push(`Line item ${index + 1}: Tax rate must be between 0 and 100`)
    }
  })
  
  return { valid: errors.length === 0, errors }
}

/**
 * Recalculate all line items and invoice totals
 */
export function recalcInvoice(
  lineItems: Partial<InvoiceLineItem>[]
): {
  lineItems: CalculatedLineItem[]
  subtotal: number
  taxTotal: number
  total: number
} {
  const calculatedLines = lineItems.map(calculateLineTotals)
  const { subtotal, taxTotal, total } = calculateInvoiceTotals(calculatedLines)
  
  return {
    lineItems: calculatedLines,
    subtotal,
    taxTotal,
    total,
  }
}