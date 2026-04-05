import { DEFAULT_CURRENCY } from '@/config/app.config'

/**
 * Format a number as currency.
 * Uses Intl.NumberFormat for locale-aware formatting.
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(
  value: number,
  decimals: number = 2,
): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Safe multiplication avoiding floating-point drift.
 * (qty * unitPrice) rounded to 2 decimal places.
 */
export function safeMultiply(a: number, b: number): number {
  return parseFloat((a * b).toFixed(2))
}

/**
 * Safe addition avoiding floating-point drift.
 */
export function safeAdd(...values: number[]): number {
  return parseFloat(values.reduce((s, v) => s + v, 0).toFixed(2))
}

/**
 * Calculate invoice line totals.
 * discount is a percentage (0-100).
 */
export function calculateLineTotals(
  qty: number,
  unitPrice: number,
  discountPct: number = 0,
  taxRatePct: number = 0,
) {
  const gross      = safeMultiply(qty, unitPrice)
  const discount   = parseFloat((gross * (discountPct / 100)).toFixed(2))
  const subtotal   = parseFloat((gross - discount).toFixed(2))
  const tax        = parseFloat((subtotal * (taxRatePct / 100)).toFixed(2))
  const total      = parseFloat((subtotal + tax).toFixed(2))
  return { gross, discount, subtotal, tax, total }
}

/**
 * Calculate invoice-level totals from line items.
 */
export function calculateInvoiceTotals(
  lines: Array<{ subtotal: number; tax: number; total: number }>,
) {
  const subtotal = parseFloat(lines.reduce((s, l) => s + l.subtotal, 0).toFixed(2))
  const taxTotal = parseFloat(lines.reduce((s, l) => s + l.tax,      0).toFixed(2))
  const total    = parseFloat(lines.reduce((s, l) => s + l.total,    0).toFixed(2))
  return { subtotal, taxTotal, total }
}

/**
 * Validate double-entry: debits must equal credits.
 */
export function validateDoubleEntry(
  lines: Array<{ debit?: number | null; credit?: number | null }>,
): boolean {
  const debits  = lines.reduce((s, l) => s + (l.debit  ?? 0), 0)
  const credits = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  return parseFloat(debits.toFixed(2)) === parseFloat(credits.toFixed(2))
}

/**
 * Get debit/credit totals for display in the journal form.
 */
export function getJournalTotals(
  lines: Array<{ debit?: number | null; credit?: number | null }>,
) {
  return {
    totalDebits:  parseFloat(lines.reduce((s, l) => s + (l.debit  ?? 0), 0).toFixed(2)),
    totalCredits: parseFloat(lines.reduce((s, l) => s + (l.credit ?? 0), 0).toFixed(2)),
  }
}