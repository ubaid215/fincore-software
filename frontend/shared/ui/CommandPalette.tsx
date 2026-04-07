'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Search, FileText, Receipt, Users, Settings, LayoutDashboard } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { useRouter } from 'next/navigation'

interface CommandItem {
  label: string
  href: string
  icon: React.ReactNode
  shortcut?: string
}

export function CommandPalette({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const items: CommandItem[] = [
    { label: 'Dashboard', href: `/dashboard/${orgId}`, icon: <LayoutDashboard className="h-4 w-4" />, shortcut: 'G D' },
    { label: 'Invoices', href: `/dashboard/${orgId}/invoices`, icon: <Receipt className="h-4 w-4" />, shortcut: 'G I' },
    { label: 'Expenses', href: `/dashboard/${orgId}/expenses`, icon: <FileText className="h-4 w-4" />, shortcut: 'G E' },
    { label: 'Members', href: `/dashboard/${orgId}/settings/members`, icon: <Users className="h-4 w-4" />, shortcut: 'G M' },
    { label: 'Settings', href: `/dashboard/${orgId}/settings`, icon: <Settings className="h-4 w-4" />, shortcut: 'G S' },
  ]

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  if (!open) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div 
        className="w-full max-w-lg mt-20 sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="overflow-hidden rounded-lg border border-border bg-white shadow-xl">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-text-tertiary shrink-0" />
            <Command.Input
              placeholder="Search commands..."
              className="flex h-10 sm:h-12 w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-tertiary"
            />
          </div>
          <Command.List className="max-h-64 sm:max-h-80 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-text-tertiary">
              No results found.
            </Command.Empty>
            {items.map((item) => (
              <Command.Item
                key={item.href}
                value={item.label}
                onSelect={() => runCommand(item.href)}
                className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 sm:py-2 text-sm outline-none aria-selected:bg-surface min-h-[44px] sm:min-h-0"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <kbd className="hidden sm:inline-block text-xs text-text-tertiary">{item.shortcut}</kbd>
                )}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}