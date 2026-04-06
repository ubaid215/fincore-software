import { validateDoubleEntry, getJournalTotals } from '@/shared/utils/currency'
import type { JournalEntryLine } from '../types/ledger.types'

export { validateDoubleEntry, getJournalTotals }

export function validateJournalEntry(lines: JournalEntryLine[]): {
  isValid: boolean
  totalDebit: number
  totalCredit: number
  difference: number
} {
  const { totalDebits, totalCredits } = getJournalTotals(lines)
  const isValid = totalDebits === totalCredits
  const difference = Math.abs(totalDebits - totalCredits)
  
  return {
    isValid,
    totalDebit: totalDebits,
    totalCredit: totalCredits,
    difference,
  }
}

export function formatAccountHierarchy(accounts: any[]): any[] {
  const accountMap = new Map()
  const roots: any[] = []
  
  accounts.forEach(account => {
    accountMap.set(account.id, { ...account, children: [] })
  })
  
  accounts.forEach(account => {
    const node = accountMap.get(account.id)
    if (account.parentId && accountMap.has(account.parentId)) {
      accountMap.get(account.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })
  
  return roots
}