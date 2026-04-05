import { format, formatDistanceToNow, isAfter, isBefore, parseISO, isValid } from 'date-fns'
import { DATE_FORMAT } from '@/config/app.config'

/**
 * Parse a date string or Date object safely.
 * Returns null if invalid.
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = typeof value === 'string' ? parseISO(value) : value
  return isValid(date) ? date : null
}

/**
 * Format for display: "01 Jan 2025"
 */
export function formatDate(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return format(date, DATE_FORMAT.display)
}

/**
 * Format short: "01 Jan"
 */
export function formatDateShort(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return format(date, DATE_FORMAT.displayShort)
}

/**
 * Format for HTML date input: "2025-01-01"
 */
export function formatDateInput(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return ''
  return format(date, DATE_FORMAT.input)
}

/**
 * Format with time: "01 Jan 2025, 14:30"
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return format(date, DATE_FORMAT.timestamp)
}

/**
 * Relative time: "3 days ago"
 */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return formatDistanceToNow(date, { addSuffix: true })
}

/**
 * Check if an invoice/expense is overdue.
 */
export function isOverdue(dueDate: string | Date | null | undefined): boolean {
  const date = parseDate(dueDate)
  if (!date) return false
  return isBefore(date, new Date())
}

/**
 * Format month: "Jan 2025"
 */
export function formatMonth(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return format(date, DATE_FORMAT.month)
}