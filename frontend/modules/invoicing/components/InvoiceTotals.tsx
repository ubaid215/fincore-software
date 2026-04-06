'use client'

import { formatCurrency } from '@/shared/utils/currency'

interface InvoiceTotalsProps {
  subtotal: number
  taxTotal: number
  total: number
  currency: string
  amountPaid?: number
  amountDue?: number
}

export function InvoiceTotals({
  subtotal,
  taxTotal,
  total,
  currency,
  amountPaid,
  amountDue,
}: InvoiceTotalsProps) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex justify-between text-sm">
        <span className="text-text-tertiary">Subtotal</span>
        <span className="text-text-primary">{formatCurrency(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-text-tertiary">Tax</span>
        <span className="text-text-primary">{formatCurrency(taxTotal, currency)}</span>
      </div>
      <div className="flex justify-between pt-2 text-base font-semibold">
        <span className="text-text-primary">Total</span>
        <span className="text-text-primary">{formatCurrency(total, currency)}</span>
      </div>
      {amountPaid !== undefined && (
        <div className="flex justify-between text-sm">
          <span className="text-text-tertiary">Amount Paid</span>
          <span className="text-success">{formatCurrency(amountPaid, currency)}</span>
        </div>
      )}
      {amountDue !== undefined && (
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <span className="text-text-primary">Amount Due</span>
          <span className={amountDue > 0 ? 'text-danger' : 'text-success'}>
            {formatCurrency(amountDue, currency)}
          </span>
        </div>
      )}
    </div>
  )
}