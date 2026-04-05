'use client'

import { useState, useEffect } from 'react'
import { Command } from 'cmdk'
import { Search, FileText, Receipt, Users, Settings, LayoutDashboard, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/shared/utils/cn'

interface SearchItem {
  label: string
  href: string
  icon: React.ReactNode
  category: string
  shortcut?: string
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

export function GlobalSearch({ open, onOpenChange, orgId }: GlobalSearchProps) {
  const router = useRouter()

  const items: SearchItem[] = [
    { label: 'Dashboard', href: `/dashboard/${orgId}`, icon: <LayoutDashboard className="h-4 w-4" />, category: 'Navigation', shortcut: 'G D' },
    { label: 'Invoices', href: `/dashboard/${orgId}/invoices`, icon: <Receipt className="h-4 w-4" />, category: 'Navigation', shortcut: 'G I' },
    { label: 'New Invoice', href: `/dashboard/${orgId}/invoices/new`, icon: <Receipt className="h-4 w-4" />, category: 'Actions' },
    { label: 'Expenses', href: `/dashboard/${orgId}/expenses`, icon: <FileText className="h-4 w-4" />, category: 'Navigation', shortcut: 'G E' },
    { label: 'New Expense', href: `/dashboard/${orgId}/expenses/new`, icon: <FileText className="h-4 w-4" />, category: 'Actions' },
    { label: 'Chart of Accounts', href: `/dashboard/${orgId}/accounts`, icon: <Building2 className="h-4 w-4" />, category: 'Navigation' },
    { label: 'Journal Entries', href: `/dashboard/${orgId}/journal`, icon: <Building2 className="h-4 w-4" />, category: 'Navigation' },
    { label: 'Members', href: `/dashboard/${orgId}/settings/members`, icon: <Users className="h-4 w-4" />, category: 'Settings', shortcut: 'G M' },
    { label: 'Settings', href: `/dashboard/${orgId}/settings`, icon: <Settings className="h-4 w-4" />, category: 'Settings', shortcut: 'G S' },
    { label: 'Profit & Loss', href: `/dashboard/${orgId}/reports/profit-loss`, icon: <LayoutDashboard className="h-4 w-4" />, category: 'Reports' },
    { label: 'Balance Sheet', href: `/dashboard/${orgId}/reports/balance-sheet`, icon: <LayoutDashboard className="h-4 w-4" />, category: 'Reports' },
    { label: 'Cash Flow', href: `/dashboard/${orgId}/reports/cash-flow`, icon: <LayoutDashboard className="h-4 w-4" />, category: 'Reports' },
  ]

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const runCommand = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div className="fixed left-[50%] top-[20%] z-50 w-full max-w-lg -translate-x-1/2">
        <Command className="overflow-hidden rounded-lg border border-border bg-white shadow-xl">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-text-tertiary" />
            <Command.Input
              placeholder="Search invoices, expenses, settings..."
              className="flex h-11 w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-tertiary"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-text-tertiary">
              No results found.
            </Command.Empty>

            {['Navigation', 'Actions', 'Settings', 'Reports'].map((category) => {
              const categoryItems = items.filter((item) => item.category === category)
              if (categoryItems.length === 0) return null
              return (
                <Command.Group key={category} heading={category} className="px-2 py-1.5">
                  {categoryItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => runCommand(item.href)}
                      className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none aria-selected:bg-surface"
                    >
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.shortcut && (
                        <kbd className="text-xs text-text-tertiary">{item.shortcut}</kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}