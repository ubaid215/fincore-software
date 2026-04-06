import { describe, it, expect } from 'vitest'
import {
  calculateLineTotals,
  calculateInvoiceTotals,
  calculateAmountDue,
  isInvoiceOverdue,
  getInvoiceStatusVariant,
  formatInvoiceNumber,
  validateLineItems,
} from '../utils/invoice.calculations'

describe('invoice calculations', () => {
  describe('calculateLineTotals', () => {
    it('calculates line item totals correctly', () => {
      const result = calculateLineTotals({
        description: 'Test item',
        quantity: 10,
        unitPrice: 100,
        discountPercent: 10,
        taxRate: 16,
      })
      
      expect(result.gross).toBe(1000)
      expect(result.discount).toBe(100)
      expect(result.subtotal).toBe(900)
      expect(result.tax).toBe(144)
      expect(result.total).toBe(1044)
    })
    
    it('handles zero discount and tax', () => {
      const result = calculateLineTotals({
        description: 'Test item',
        quantity: 5,
        unitPrice: 50,
        discountPercent: 0,
        taxRate: 0,
      })
      
      expect(result.gross).toBe(250)
      expect(result.discount).toBe(0)
      expect(result.subtotal).toBe(250)
      expect(result.tax).toBe(0)
      expect(result.total).toBe(250)
    })
  })
  
  describe('calculateInvoiceTotals', () => {
    it('sums multiple line items', () => {
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
  
  describe('calculateAmountDue', () => {
    it('calculates amount due correctly', () => {
      expect(calculateAmountDue(1000, 300)).toBe(700)
      expect(calculateAmountDue(1000, 1000)).toBe(0)
      expect(calculateAmountDue(1000, 1200)).toBe(0)
    })
  })
  
  describe('isInvoiceOverdue', () => {
    it('returns true for past due date with SENT status', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      expect(isInvoiceOverdue(pastDate.toISOString(), 'SENT')).toBe(true)
    })
    
    it('returns false for future due date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      expect(isInvoiceOverdue(futureDate.toISOString(), 'SENT')).toBe(false)
    })
    
    it('returns false for non-SENT status', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      expect(isInvoiceOverdue(pastDate.toISOString(), 'PAID')).toBe(false)
    })
  })
  
  describe('getInvoiceStatusVariant', () => {
    it('returns correct variants', () => {
      expect(getInvoiceStatusVariant('DRAFT')).toBe('draft')
      expect(getInvoiceStatusVariant('SENT')).toBe('info')
      expect(getInvoiceStatusVariant('PAID')).toBe('success')
      expect(getInvoiceStatusVariant('OVERDUE')).toBe('danger')
      expect(getInvoiceStatusVariant('VOID')).toBe('default')
    })
  })
  
  describe('formatInvoiceNumber', () => {
    it('formats with default prefix', () => {
      expect(formatInvoiceNumber(1)).toBe('INV-000001')
      expect(formatInvoiceNumber(123)).toBe('INV-000123')
    })
    
    it('formats with custom prefix', () => {
      expect(formatInvoiceNumber(1, 'INV/')).toBe('INV/000001')
    })
  })
  
  describe('validateLineItems', () => {
    it('returns valid for correct line items', () => {
      const lines = [
        { description: 'Item 1', quantity: 1, unitPrice: 100, discountPercent: 0, taxRate: 0 },
      ]
      const result = validateLineItems(lines)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('returns errors for invalid line items', () => {
      const lines = [
        { description: '', quantity: 0, unitPrice: -10, discountPercent: 0, taxRate: 0 },
      ]
      const result = validateLineItems(lines)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})