'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useCashFlow } from '../hooks/useCashFlow'
import { Card, Button, DateRangePicker, PageHeader } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { Download } from 'lucide-react'
import type { DateRange } from '../types/reports.types'

interface CashFlowReportProps {
  orgId: string
}

function CashFlowSection({ title, lines, total }: { title: string; lines: any[]; total: number }) {
  if (lines.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{title}</h3>
      <div className="space-y-1">
        {lines.map((line) => (
          <div key={line.accountId} className="flex justify-between text-sm" style={{ marginLeft: `${line.level * 16}px` }}>
            <span className="text-text-secondary">{line.accountName}</span>
            <span className={cn(
              'font-mono',
              line.amount >= 0 ? 'text-success' : 'text-danger'
            )}>
              {formatCurrency(line.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
        <span className="text-text-primary">Net {title}</span>
        <span className={cn('font-mono', total >= 0 ? 'text-success' : 'text-danger')}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}

export default function CashFlowReport({ orgId }: CashFlowReportProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  const { data, isLoading } = useCashFlow(orgId, { dateRange })

  // Mock chart data - replace with actual data from API
  const chartData = [
    { month: 'Jan', operating: 15000, investing: -5000, financing: 2000 },
    { month: 'Feb', operating: 18000, investing: -3000, financing: 1000 },
    { month: 'Mar', operating: 22000, investing: -8000, financing: 3000 },
    { month: 'Apr', operating: 20000, investing: -2000, financing: -1000 },
    { month: 'May', operating: 25000, investing: -6000, financing: 2000 },
    { month: 'Jun', operating: 28000, investing: -4000, financing: -2000 },
  ]

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 rounded bg-surface-2" />
          <div className="h-64 rounded bg-surface-2" />
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
          <h2 className="text-lg font-semibold text-text-primary">Cash Flow Statement</h2>
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

      {/* Chart */}
      <div className="mb-8 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DE" />
            <XAxis dataKey="month" stroke="#79766F" />
            <YAxis stroke="#79766F" tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip formatter={(value) => formatCurrency(value as number)} />
            <Legend />
            <Area type="monotone" dataKey="operating" name="Operating" fill="#2A7D6F" stroke="#2A7D6F" fillOpacity={0.3} />
            <Area type="monotone" dataKey="investing" name="Investing" fill="#1E6091" stroke="#1E6091" fillOpacity={0.3} />
            <Area type="monotone" dataKey="financing" name="Financing" fill="#92660A" stroke="#92660A" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cash Flow Sections */}
      <div className="grid gap-8 md:grid-cols-3">
        <CashFlowSection title="Operating Activities" lines={report.operating.lines} total={report.operating.total} />
        <CashFlowSection title="Investing Activities" lines={report.investing.lines} total={report.investing.total} />
        <CashFlowSection title="Financing Activities" lines={report.financing.lines} total={report.financing.total} />
      </div>

      {/* Net Cash Flow Summary */}
      <div className="mt-6 rounded-md bg-accent-subtle p-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-text-primary">Beginning Cash Balance</span>
            <span className="font-mono text-text-primary">{formatCurrency(report.beginningCash)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-primary">Net Cash Flow</span>
            <span className={cn('font-mono', report.netCashFlow >= 0 ? 'text-success' : 'text-danger')}>
              {formatCurrency(report.netCashFlow)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span className="text-text-primary">Ending Cash Balance</span>
            <span className="font-mono text-text-primary">{formatCurrency(report.endingCash)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}