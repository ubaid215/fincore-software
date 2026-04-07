'use client'

import { Switch } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'

interface PricingToggleProps {
  isAnnual: boolean
  onToggle: (isAnnual: boolean) => void
}

export function PricingToggle({ isAnnual, onToggle }: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className={cn('text-sm', !isAnnual ? 'text-text-primary font-medium' : 'text-text-tertiary')}>
        Monthly
      </span>
      <Switch checked={isAnnual} onCheckedChange={onToggle} />
      <span className={cn('text-sm', isAnnual ? 'text-text-primary font-medium' : 'text-text-tertiary')}>
        Annual
        <span className="ml-1.5 rounded-full bg-success-subtle px-2 py-0.5 text-xs text-success">
          Save 20%
        </span>
      </span>
    </div>
  )
}