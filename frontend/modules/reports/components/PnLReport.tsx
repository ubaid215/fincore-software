'use client'

import { useState } from 'react'
import { usePnLReport } from '../hooks/usePnLReport'
import { Card, Button, DateRangePicker, PageHeader } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import type { DateRange, FinancialStatementLine } from '../types/reports.types'

interface PnLReportProps {
  orgId: string
}

function StatementSection({ title, lines, total }: { title: string; lines: FinancialStatementLine[]; total: number }) {
  if (lines.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{title}</h3>
      <div className="space-y-1">
        {lines.map((line) => (
          <div key={line.accountId} className="flex justify-between text-sm" style={{ marginLeft: `${line.level * 16}px` }}>
            <span className="text-text-secondary">{line.accountName}</span>
            <span className="font-mono text-text-primary">{formatCurrency(line.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
        <span className="text-text-primary">Total {title}</span>
        <span className="font-mono text-text-primary">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

export default function PnLReport({ orgId }: PnLReportProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  const { data, isLoading } = usePnLReport(orgId, { dateRange })

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 rounded bg-surface-2" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-3/4 rounded bg-surface-2" />
          </div>
        </div>
      </Card>
    )
  }

  const report = data?.data
  if (!report) return null

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Profit & Loss Statement</h2>
          <p className="text-sm text-text-tertiary">
            {new Date(dateRange.from).toLocaleDateString()} - {new Date(dateRange.to).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="secondary" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <StatementSection title="Revenue" lines={report.revenue} total={report.totalRevenue} />
        <StatementSection title="Cost of Goods Sold" lines={report.cogs} total={report.totalCogs} />

        <div className="rounded-md bg-surface p-4">
          <div className="flex justify-between">
            <span className="font-semibold text-text-primary">Gross Profit</span>
            <div className="text-right">
              <span className="font-semibold text-text-primary">{formatCurrency(report.grossProfit)}</span>
              <span className="ml-2 text-sm text-text-tertiary">({report.grossMargin}% margin)</span>
            </div>
          </div>
        </div>

        <StatementSection title="Expenses" lines={report.expenses} total={report.totalExpenses} />

        <div className="rounded-md bg-accent-subtle p-4">
          <div className="flex justify-between">
            <span className="font-semibold text-accent">Net Income</span>
            <div className="text-right">
              <span className="font-semibold text-accent">{formatCurrency(report.netIncome)}</span>
              <span className="ml-2 text-sm text-accent/80">({report.netMargin}% margin)</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}