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
          'min-h-[40px] sm:min-h-0',
        )}
      >
        <span className="text-text-tertiary truncate">{displayText}</span>
        <Calendar className="h-4 w-4 text-text-tertiary shrink-0 ml-2" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className={cn(
            'z-50 rounded-md border border-border bg-white p-4 shadow-md',
            'fixed bottom-0 left-0 right-0 sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1',
            'rounded-t-xl sm:rounded-md',
            'animate-in slide-in-from-bottom sm:slide-in-from-top-2'
          )}>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
                <input
                  type="date"
                  value={value.from || ''}
                  onChange={handleFromChange}
                  className="w-full rounded border border-border px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
                <input
                  type="date"
                  value={value.to || ''}
                  onChange={handleToChange}
                  className="w-full rounded border border-border px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setIsOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}