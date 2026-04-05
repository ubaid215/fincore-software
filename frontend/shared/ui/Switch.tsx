'use client'

import { forwardRef } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/shared/utils/cn'

export interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, label, disabled, className }, ref) => {
    return (
      <div className="flex items-center gap-3">
        <SwitchPrimitive.Root
          ref={ref}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={cn(
            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
            'border-2 border-transparent transition-colors focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-accent' : 'bg-border-2',
            className,
          )}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
              checked ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </SwitchPrimitive.Root>
        {label && (
          <label className="text-sm text-text-secondary cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    )
  },
)

Switch.displayName = 'Switch'