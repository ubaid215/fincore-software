'use client'

import { useParams } from 'next/navigation'
import { useDashboardStats } from '@/modules/reports'
import { Card, StatCard, PageHeader, Skeleton } from '@/shared/ui'
import { DollarSign, Receipt, FileText, TrendingUp, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function DashboardHomePage() {
  const params = useParams()
  const orgId = params.orgId as string
  const { data, isLoading } = useDashboardStats(orgId)

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Welcome back! Here's what's happening with your business." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const stats = data?.data
  if (!stats) return null

  const statsConfig = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue.value),
      trend: { value: stats.totalRevenue.change, label: 'vs last month' },
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: 'Outstanding Invoices',
      value: formatCurrency(stats.outstandingInvoices.value),
      trend: { value: stats.outstandingInvoices.change, label: 'vs last month' },
      icon: <Receipt className="h-5 w-5" />,
    },
    {
      title: 'Pending Expenses',
      value: formatCurrency(stats.pendingExpenses.value),
      trend: { value: stats.pendingExpenses.change, label: 'vs last month' },
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: 'Net Profit',
      value: formatCurrency(stats.netProfit.value),
      trend: { value: stats.netProfit.change, label: 'vs last month' },
      icon: <TrendingUp className="h-5 w-5" />,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your business."
      />

      {/* Stats Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Cash Flow Chart */}
      <div className="mt-8">
        <Card className="p-6">
          <h3 className="mb-4 text-base font-medium text-text-primary">Cash Flow Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DE" />
                <XAxis dataKey="month" stroke="#79766F" />
                <YAxis stroke="#79766F" tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Income" stroke="#2A7D6F" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" name="Expenses" stroke="#B83030" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-text-primary">Recent Invoices</h3>
            <Link href={`/dashboard/${orgId}/invoices`} className="text-sm text-accent hover:text-accent-hover flex items-center gap-1">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/dashboard/${orgId}/invoices/${invoice.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface"
              >
                <div>
                  <p className="font-mono text-sm font-medium text-text-primary">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-text-tertiary">{invoice.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(invoice.total)}</p>
                  <p className="text-xs text-text-tertiary">Due {formatDate(invoice.dueDate)}</p>
                </div>
              </Link>
            ))}
            {stats.recentInvoices.length === 0 && (
              <p className="text-center text-sm text-text-tertiary py-8">No recent invoices</p>
            )}
          </div>
        </Card>

        {/* Recent Expenses */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-text-primary">Recent Expenses</h3>
            <Link href={`/dashboard/${orgId}/expenses`} className="text-sm text-accent hover:text-accent-hover flex items-center gap-1">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentExpenses.map((expense) => (
              <Link
                key={expense.id}
                href={`/dashboard/${orgId}/expenses/${expense.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface"
              >
                <div>
                  <p className="font-mono text-sm font-medium text-text-primary">{expense.expenseNumber}</p>
                  <p className="text-xs text-text-tertiary">{expense.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(expense.total)}</p>
                  <p className="text-xs text-text-tertiary">{formatDate(expense.expenseDate)}</p>
                </div>
              </Link>
            ))}
            {stats.recentExpenses.length === 0 && (
              <p className="text-center text-sm text-text-tertiary py-8">No recent expenses</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}