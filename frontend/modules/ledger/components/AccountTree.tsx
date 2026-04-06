'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, Folder } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { formatCurrency } from '@/shared/utils/currency'
import type { Account } from '../types/ledger.types'

interface AccountTreeProps {
  accounts: Account[]
  onSelectAccount?: (account: Account) => void
  selectedAccountId?: string
  currency?: string
}

function AccountNode({ 
  account, 
  level = 0, 
  onSelect, 
  isSelected,
  currency = 'USD'
}: { 
  account: Account
  level: number
  onSelect?: (account: Account) => void
  isSelected?: boolean
  currency?: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = account.children && account.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center rounded-md px-2 py-1.5 transition-colors',
          'hover:bg-surface',
          isSelected && 'bg-accent-subtle'
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect?.(account)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
            }}
            className="mr-1 text-text-tertiary hover:text-text-primary"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        {hasChildren ? (
          <FolderOpen className="mr-2 h-4 w-4 text-accent" />
        ) : (
          <Folder className="mr-2 h-4 w-4 text-text-tertiary" />
        )}
        <span className="flex-1 text-sm">
          <span className="font-mono text-xs text-text-tertiary mr-2">{account.code}</span>
          {account.name}
        </span>
        <span className={cn(
          'text-sm font-mono',
          account.balance > 0 ? 'text-text-primary' : 'text-text-tertiary'
        )}>
          {formatCurrency(Math.abs(account.balance), currency)}
        </span>
      </div>
      {hasChildren && isOpen && (
        <div>
          {account.children?.map((child) => (
            <AccountNode
              key={child.id}
              account={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={isSelected}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AccountTree({ accounts, onSelectAccount, selectedAccountId, currency }: AccountTreeProps) {
  const typeOrder: Record<string, number> = {
    ASSET: 1,
    LIABILITY: 2,
    EQUITY: 3,
    REVENUE: 4,
    EXPENSE: 5,
  }

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = []
    }
    acc[account.type].push(account)
    return acc
  }, {} as Record<string, Account[]>)

  const typeLabels: Record<string, string> = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    REVENUE: 'Revenue',
    EXPENSE: 'Expenses',
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedAccounts)
        .sort((a, b) => typeOrder[a[0]] - typeOrder[b[0]])
        .map(([type, typeAccounts]) => (
          <div key={type}>
            <h3 className="mb-2 text-sm font-semibold text-text-primary">{typeLabels[type]}</h3>
            <div className="space-y-0.5">
              {typeAccounts.map((account) => (
                <AccountNode
                  key={account.id}
                  account={account}
                  onSelect={onSelectAccount}
                  isSelected={selectedAccountId === account.id}
                  currency={currency}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}