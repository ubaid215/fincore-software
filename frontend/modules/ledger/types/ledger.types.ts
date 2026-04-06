import type { ID, Timestamps } from '@/shared/types'

export type AccountType = 
  | 'ASSET' 
  | 'LIABILITY' 
  | 'EQUITY' 
  | 'REVENUE' 
  | 'EXPENSE'

export interface Account {
  id: ID
  code: string
  name: string
  type: AccountType
  parentId: ID | null
  isActive: boolean
  description?: string
  balance: number
  createdAt: string
  updatedAt: string
  children?: Account[]
}

export interface JournalEntryLine {
  id?: string
  journalEntryId?: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number | null
  credit: number | null
  description?: string
}

export interface JournalEntry extends Timestamps {
  id: ID
  entryNumber: string
  organizationId: ID
  entryDate: string
  description: string
  reference?: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  createdBy: ID
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface CreateJournalEntryRequest {
  entryDate: string
  description: string
  reference?: string
  lines: Omit<JournalEntryLine, 'id' | 'journalEntryId' | 'accountCode' | 'accountName'>[]
}

export interface JournalEntryFilters {
  dateFrom?: string
  dateTo?: string
  accountId?: string
  search?: string
  page?: number
  limit?: number
}