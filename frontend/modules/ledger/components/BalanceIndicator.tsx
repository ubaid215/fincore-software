'use client'

import { cn } from '@/shared/utils/cn'
import { CheckCircle, AlertCircle } from 'lucide-react'

interface BalanceIndicatorProps {
  totalDebit: number
  totalCredit: number
  className?: string
}

export function BalanceIndicator({ totalDebit, totalCredit, className }: BalanceIndicatorProps) {
  const isBalanced = totalDebit === totalCredit
  const difference = Math.abs(totalDebit - totalCredit)

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {isBalanced ? (
        <>
          <CheckCircle className="h-4 w-4 text-success" />
          <span className="text-success-text">Balanced</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-danger" />
          <span className="text-danger-text">
            Off by {difference.toFixed(2)}
          </span>
        </>
      )}
    </div>
  )
}