'use client'

import { useState } from 'react'
import { useBalanceSheet } from '../hooks/useBalanceSheet'
import { Card, Button, Input, PageHeader } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { Download } from 'lucide-react'

interface BalanceSheetReportProps {
  orgId: string
}

function AssetSection({ title, assets }: { title: string; assets: { lines: any[]; total: number } }) {
  if (assets.lines.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{title}</h3>
      <div className="space-y-1">
        {assets.lines.map((line) => (
          <div key={line.accountId} className="flex justify-between text-sm" style={{ marginLeft: `${line.level * 16}px` }}>
            <span className="text-text-secondary">{line.accountName}</span>
            <span className="font-mono text-text-primary">{formatCurrency(line.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
        <span className="text-text-primary">Total {title}</span>
        <span className="font-mono text-text-primary">{formatCurrency(assets.total)}</span>
      </div>
    </div>
  )
}

export default function BalanceSheetReport({ orgId }: BalanceSheetReportProps) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const { data, isLoading } = useBalanceSheet(orgId, asOfDate)

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

  const isBalanced = report.assets.total === report.totalLiabilitiesEquity

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Balance Sheet</h2>
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

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left side - Assets */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-text-primary">Assets</h2>
          <AssetSection title="Current Assets" assets={report.assets.current} />
          <AssetSection title="Fixed Assets" assets={report.assets.fixed} />
          <AssetSection title="Other Assets" assets={report.assets.other} />
          <div className="mt-4 rounded-md bg-surface p-3">
            <div className="flex justify-between font-semibold">
              <span className="text-text-primary">Total Assets</span>
              <span className="text-text-primary">{formatCurrency(report.assets.total)}</span>
            </div>
          </div>
        </div>

        {/* Right side - Liabilities & Equity */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-text-primary">Liabilities & Equity</h2>
          <AssetSection title="Current Liabilities" assets={report.liabilities.current} />
          <AssetSection title="Long-term Liabilities" assets={report.liabilities.longTerm} />
          <div className="rounded-md bg-surface p-3">
            <div className="flex justify-between font-semibold">
              <span className="text-text-primary">Total Liabilities</span>
              <span className="text-text-primary">{formatCurrency(report.liabilities.total)}</span>
            </div>
          </div>

          <div className="mt-6">
            <AssetSection title="Equity" assets={report.equity.capital} />
            {report.equity.retainedEarnings.lines.length > 0 && (
              <AssetSection title="Retained Earnings" assets={report.equity.retainedEarnings} />
            )}
            <div className="mt-4 rounded-md bg-surface p-3">
              <div className="flex justify-between font-semibold">
                <span className="text-text-primary">Total Equity</span>
                <span className="text-text-primary">{formatCurrency(report.equity.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-md bg-accent-subtle p-4">
            <div className="flex justify-between font-semibold">
              <span className="text-accent">Total Liabilities & Equity</span>
              <span className="text-accent">{formatCurrency(report.totalLiabilitiesEquity)}</span>
            </div>
            {!isBalanced && (
              <p className="mt-2 text-sm text-danger">Warning: Balance sheet is not balanced!</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}