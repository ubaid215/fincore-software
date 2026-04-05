import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatNumber,
  safeMultiply,
  safeAdd,
  calculateLineTotals,
  calculateInvoiceTotals,
  validateDoubleEntry,
  getJournalTotals,
} from './currency'

describe('currency utils', () => {
  describe('formatCurrency', () => {
    it('formats PKR correctly', () => {
      expect(formatCurrency(1234.56, 'PKR')).toContain('₨')
      expect(formatCurrency(1234.56, 'PKR')).toContain('1,234.56')
    })

    it('formats USD correctly', () => {
      expect(formatCurrency(99.99, 'USD')).toContain('$')
    })

    it('handles zero', () => {
      expect(formatCurrency(0, 'PKR')).toContain('0.00')
    })
  })

  describe('formatNumber', () => {
    it('formats with thousand separators', () => {
      expect(formatNumber(1234567.89, 2)).toBe('1,234,567.89')
    })

    it('respects decimal places', () => {
      expect(formatNumber(123.456, 1)).toBe('123.5')
    })
  })

  describe('safeMultiply', () => {
    it('multiplies without floating point errors', () => {
      expect(safeMultiply(0.1, 0.2)).toBe(0.02)
      expect(safeMultiply(2.5, 4.2)).toBe(10.5)
    })

    it('rounds to 2 decimal places', () => {
      expect(safeMultiply(1.234, 1.234)).toBe(1.52)
    })
  })

  describe('safeAdd', () => {
    it('adds without floating point errors', () => {
      expect(safeAdd(0.1, 0.2)).toBe(0.3)
      expect(safeAdd(1.11, 2.22, 3.33)).toBe(6.66)
    })
  })

  describe('calculateLineTotals', () => {
    it('calculates gross, discount, subtotal, tax, total correctly', () => {
      const result = calculateLineTotals(10, 100, 10, 16)
      expect(result.gross).toBe(1000)
      expect(result.discount).toBe(100)
      expect(result.subtotal).toBe(900)
      expect(result.tax).toBe(144)
      expect(result.total).toBe(1044)
    })

    it('handles zero discount and tax', () => {
      const result = calculateLineTotals(5, 50)
      expect(result.gross).toBe(250)
      expect(result.discount).toBe(0)
      expect(result.subtotal).toBe(250)
      expect(result.tax).toBe(0)
      expect(result.total).toBe(250)
    })
  })

  describe('calculateInvoiceTotals', () => {
    it('sums multiple line items correctly', () => {
      const lines = [
        { subtotal: 900, tax: 144, total: 1044 },
        { subtotal: 500, tax: 80, total: 580 },
      ]
      const result = calculateInvoiceTotals(lines)
      expect(result.subtotal).toBe(1400)
      expect(result.taxTotal).toBe(224)
      expect(result.total).toBe(1624)
    })
  })

  describe('validateDoubleEntry', () => {
    it('returns true when debits equal credits', () => {
      const lines = [
        { debit: 100, credit: null },
        { debit: null, credit: 100 },
      ]
      expect(validateDoubleEntry(lines)).toBe(true)
    })

    it('returns false when debits do not equal credits', () => {
      const lines = [
        { debit: 100, credit: null },
        { debit: null, credit: 50 },
      ]
      expect(validateDoubleEntry(lines)).toBe(false)
    })

    it('handles multiple lines', () => {
      const lines = [
        { debit: 50, credit: null },
        { debit: 30, credit: null },
        { debit: null, credit: 80 },
      ]
      expect(validateDoubleEntry(lines)).toBe(true)
    })
  })

  describe('getJournalTotals', () => {
    it('calculates total debits and credits', () => {
      const lines = [
        { debit: 100, credit: null },
        { debit: 50, credit: null },
        { debit: null, credit: 150 },
      ]
      const result = getJournalTotals(lines)
      expect(result.totalDebits).toBe(150)
      expect(result.totalCredits).toBe(150)
    })
  })
})