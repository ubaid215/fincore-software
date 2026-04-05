import { describe, it, expect, vi } from 'vitest'
import {
  parseDate,
  formatDate,
  formatDateShort,
  formatDateInput,
  formatDateTime,
  formatRelative,
  isOverdue,
  formatMonth,
} from './date'

describe('date utils', () => {
  const mockDate = '2025-01-15T10:30:00Z'

  describe('parseDate', () => {
    it('parses ISO string to Date', () => {
      const result = parseDate('2025-01-15')
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2025)
    })

    it('returns null for invalid input', () => {
      expect(parseDate(null)).toBeNull()
      expect(parseDate('invalid')).toBeNull()
    })
  })

  describe('formatDate', () => {
    it('formats date as "dd MMM yyyy"', () => {
      expect(formatDate('2025-01-15')).toBe('15 Jan 2025')
    })

    it('returns em dash for null', () => {
      expect(formatDate(null)).toBe('—')
    })
  })

  describe('formatDateShort', () => {
    it('formats date as "dd MMM"', () => {
      expect(formatDateShort('2025-01-15')).toBe('15 Jan')
    })
  })

  describe('formatDateInput', () => {
    it('formats date as "yyyy-MM-dd" for input', () => {
      expect(formatDateInput('2025-01-15')).toBe('2025-01-15')
    })

    it('returns empty string for null', () => {
      expect(formatDateInput(null)).toBe('')
    })
  })

  describe('formatDateTime', () => {
    it('formats with time', () => {
      const result = formatDateTime('2025-01-15T14:30:00')
      expect(result).toMatch(/15 Jan 2025, 14:30/)
    })
  })

  describe('formatRelative', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-20T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns relative time string', () => {
      expect(formatRelative('2025-01-15')).toContain('ago')
    })
  })

  describe('isOverdue', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-20'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns true for date in past', () => {
      expect(isOverdue('2025-01-15')).toBe(true)
    })

    it('returns false for date in future', () => {
      expect(isOverdue('2025-01-25')).toBe(false)
    })

    it('returns false for null', () => {
      expect(isOverdue(null)).toBe(false)
    })
  })

  describe('formatMonth', () => {
    it('formats as "MMM yyyy"', () => {
      expect(formatMonth('2025-01-15')).toBe('Jan 2025')
    })
  })
})