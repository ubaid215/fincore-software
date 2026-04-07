'use client'

import { useState } from 'react'
import { useAgedReceivables } from '../hooks/useAgedReceivables'
import { Card, Button, Input, DataGrid, PageHeader } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { Download } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import type { AgedReceivable } from '../types/reports.types'

interface AgedReceivablesReportProps {
  orgId: string
}

const columnHelper = createColumnHelper<AgedReceivable>()

const columns = [
  columnHelper.accessor('customerName', {
    header: 'Customer',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('current', {
    header: 'Current',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('days1_30', {
    header: '1-30 Days',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('days31_60', {
    header: '31-60 Days',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('days61_90', {
    header: '61-90 Days',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('days90_plus', {
    header: '90+ Days',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('total', {
    header: 'Total',
    cell: (info) => <span className="font-semibold">{formatCurrency(info.getValue())}</span>,
  }),
]

export default function AgedReceivablesReport({ orgId }: AgedReceivablesReportProps) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const { data, isLoading } = useAgedReceivables(orgId, asOfDate)

  const receivables = data?.data ?? []
  const totalOutstanding = receivables.reduce((sum, r) => sum + r.total, 0)

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Aged Receivables</h2>
          <p className="text-sm text-text-tertiary">As of {new Date(asOfDate).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-3">
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-40" />
          <Button variant="secondary" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <div className="rounded-md bg-surface p-3">
          <div className="flex gap-4">
            <span className="text-sm text-text-tertiary">Total Outstanding:</span>
            <span className="font-semibold text-text-primary">{formatCurrency(totalOutstanding)}</span>
          </div>
        </div>
      </div>

      <DataGrid columns={columns} data={receivables} isLoading={isLoading} />
    </Card>
  )
}