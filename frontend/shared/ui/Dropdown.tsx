'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/shared/utils/cn'

export interface DropdownItem {
  label: string
  onClick?: () => void
  icon?: React.ReactNode
  destructive?: boolean
  disabled?: boolean
  divider?: boolean
}

export interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  alignOffset?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function Dropdown({ 
  trigger, 
  items, 
  align = 'end', 
  sideOffset = 4,
  alignOffset = 0,
  side = 'bottom'
}: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'z-50 min-w-[180px] max-w-[calc(100vw-2rem)] sm:max-w-none overflow-hidden rounded-md border border-border bg-white shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            // Mobile optimization
            'max-h-[80vh] overflow-y-auto',
          )}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          side={side}
        >
          {items.map((item, index) => (
            <div key={index}>
              {item.divider ? (
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
              ) : (
                <DropdownMenu.Item
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 sm:py-2 text-sm outline-none',
                    'transition-colors focus:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    item.destructive ? 'text-danger focus:bg-danger-subtle' : 'text-text-secondary',
                    // Touch-friendly
                    'min-h-[44px] sm:min-h-0',
                  )}
                >
                  {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                </DropdownMenu.Item>
              )}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}