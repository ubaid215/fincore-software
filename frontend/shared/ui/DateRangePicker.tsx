'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { formatDateInput } from '@/shared/utils/date'
import { cn } from '@/shared/utils/cn'
import { Button } from './Button'

export interface DateRange {
  from: string | null
  to: string | null
}

export interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  label?: string
  className?: string
}

export function DateRangePicker({ value, onChange, label, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayText =
    value.from && value.to
      ? `${formatDateInput(value.from)} – ${formatDateInput(value.to)}`
      : value.from
        ? `From ${formatDateInput(value.from)}`
        : value.to
          ? `Until ${formatDateInput(value.to)}`
          : 'Select date range'

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, from: e.target.value || null })
  }

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, to: e.target.value || null })
  }

  const handleClear = () => {
    onChange({ from: null, to: null })
    setIsOpen(false)
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2 tracking-wide">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm',
          'text-text-primary hover:border-border-2 transition-colors',
        )}
      >
        <span className="text-text-tertiary">{displayText}</span>
        <Calendar className="h-4 w-4 text-text-tertiary" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-border bg-white p-4 shadow-md">
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
              <input
                type="date"
                value={value.from || ''}
                onChange={handleFromChange}
                className="rounded border border-border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
              <input
                type="date"
                value={value.to || ''}
                onChange={handleToChange}
                className="rounded border border-border px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}