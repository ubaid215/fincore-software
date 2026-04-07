'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/shared/utils/cn'
import { useRef, useEffect, useState } from 'react'

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={cn('w-full', className)}
    >
      {children}
    </TabsPrimitive.Root>
  )
}

export interface TabsListProps {
  children: React.ReactNode
  className?: string
  scrollable?: boolean
}

export function TabsList({ children, className, scrollable = true }: TabsListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScroll, setShowScroll] = useState(false)

  useEffect(() => {
    if (scrollable && scrollRef.current) {
      const hasScroll = scrollRef.current.scrollWidth > scrollRef.current.clientWidth
      setShowScroll(hasScroll)
    }
  }, [children, scrollable])

  return (
    <div className={cn('relative', showScroll && 'overflow-x-auto pb-2', !showScroll && 'flex justify-center')}>
      <TabsPrimitive.List
        ref={scrollRef}
        className={cn(
          'inline-flex h-10 items-center rounded-md bg-surface p-1',
          scrollable && 'flex-nowrap',
          className,
        )}
      >
        {children}
      </TabsPrimitive.List>
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium',
        'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-text-primary',
        'text-text-tertiary hover:text-text-secondary',
        // Touch-friendly
        'min-h-[32px]',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export const TabsContent = TabsPrimitive.Content