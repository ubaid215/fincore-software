'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/utils/cn'

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="flex items-start gap-2">
        <div className="flex h-5 items-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={cn(
              'h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent/20',
              'focus:outline-none focus:ring-offset-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            aria-invalid={!!error}
            {...props}
          />
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-sm text-text-secondary leading-tight cursor-pointer select-none"
          >
            {label}
          </label>
        )}
        {error && <p className="text-sm text-danger mt-1">{error}</p>}
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'