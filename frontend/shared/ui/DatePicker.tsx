'use client'

import { useState, forwardRef } from 'react'
import { Calendar } from 'lucide-react'
import { formatDateInput, parseDate } from '@/shared/utils/date'
import { cn } from '@/shared/utils/cn'
import { Button } from './Button'

export interface DatePickerProps {
  value?: string | Date | null
  onChange?: (date: string | null) => void
  label?: string
  error?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onChange, label, error, placeholder = 'Select date', disabled, className }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const formattedValue = value ? formatDateInput(value) : ''

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      onChange?.(newValue || null)
    }

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className="block text-sm font-medium text-text-secondary mb-2 tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="date"
            value={formattedValue}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full rounded-md border bg-white px-3 py-2 pr-9 text-text-primary placeholder:text-text-disabled',
              'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
              'disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-disabled',
              'transition-all duration-200 text-sm',
              error
                ? 'border-danger focus:border-danger focus:ring-danger/20'
                : 'border-border hover:border-border-2',
            )}
          />
          <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        </div>
        {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
      </div>
    )
  },
)

DatePicker.displayName = 'DatePicker'