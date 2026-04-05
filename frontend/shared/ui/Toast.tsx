'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export interface ToastProps {
  title?: string
  description?: string
  variant?: 'success' | 'error' | 'warning' | 'info'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const variants = {
  success: 'border-success/20 bg-success-subtle',
  error: 'border-danger/20 bg-danger-subtle',
  warning: 'border-warning/20 bg-warning-subtle',
  info: 'border-info/20 bg-info-subtle',
}

const iconColors = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

export function Toast({ title, description, variant = 'info', open, onOpenChange }: ToastProps) {
  const Icon = icons[variant]

  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'relative flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full',
        variants[variant],
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', iconColors[variant])} />
      <div className="flex-1">
        {title && <ToastPrimitive.Title className="text-sm font-semibold text-text-primary">{title}</ToastPrimitive.Title>}
        {description && <ToastPrimitive.Description className="text-sm text-text-secondary mt-0.5">{description}</ToastPrimitive.Description>}
      </div>
      <ToastPrimitive.Close className="rounded-full p-1 hover:bg-surface-2 transition-colors">
        <X className="h-4 w-4 text-text-tertiary" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <ToastPrimitive.Provider>{children}</ToastPrimitive.Provider>
}

export const ToastViewport = () => (
  <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 max-w-full w-full sm:max-w-sm" />
)