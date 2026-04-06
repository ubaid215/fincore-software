'use client'

import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { DataGridVirtual, Button } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import type { JournalEntry } from '../types/ledger.types'

const columnHelper = createColumnHelper<JournalEntry>()

interface JournalTableProps {
  data: JournalEntry[]
  isLoading?: boolean
  currency?: string
}

export function JournalTable({ data, isLoading, currency = 'USD' }: JournalTableProps) {
  const router = useRouter()

  const columns = [
    columnHelper.accessor('entryNumber', {
      header: 'Entry #',
      cell: (info) => (
        <span className="font-mono text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('entryDate', {
      header: 'Date',
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => (
        <span className="line-clamp-1 max-w-[300px]">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('reference', {
      header: 'Reference',
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('totalDebit', {
      header: 'Debit',
      cell: (info) => formatCurrency(info.getValue(), currency),
    }),
    columnHelper.accessor('totalCredit', {
      header: 'Credit',
      cell: (info) => formatCurrency(info.getValue(), currency),
    }),
    columnHelper.accessor('createdByName', {
      header: 'Created By',
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/journal/${info.row.original.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    }),
  ]

  return (
    <DataGridVirtual
      columns={columns}
      data={data}
      isLoading={isLoading}
      rowHeight={48}
      emptyState={
        <div className="py-12 text-center">
          <p className="text-text-tertiary">No journal entries found</p>
        </div>
      }
    />
  )
}