'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Button } from './Button'

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  side?: 'right' | 'left'
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[480px]',
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
  size = 'md',
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex flex-col bg-white shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
            side === 'right'
              ? 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
              : 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            sizes[size],
          )}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            {title && <Dialog.Title className="text-lg font-semibold text-text-primary">{title}</Dialog.Title>}
            <Dialog.Close asChild>
              <Button variant="icon" size="sm" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}