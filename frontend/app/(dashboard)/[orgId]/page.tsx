'use client'

import { useParams } from 'next/navigation'
import { Card, StatCard, PageHeader } from '@/shared/ui'
import { DollarSign, Receipt, FileText, TrendingUp } from 'lucide-react'

export default function DashboardHomePage() {
  const params = useParams()
  const orgId = params.orgId as string

  // TODO: Replace with actual API calls in Phase 6
  const stats = [
    {
      title: 'Total Revenue',
      value: '$124,567',
      trend: { value: 12.5, label: 'vs last month' },
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: 'Outstanding Invoices',
      value: '$45,230',
      trend: { value: -8.2, label: 'vs last month' },
      icon: <Receipt className="h-5 w-5" />,
    },
    {
      title: 'Pending Expenses',
      value: '$12,890',
      trend: { value: 5.3, label: 'vs last month' },
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: 'Net Profit',
      value: '$66,447',
      trend: { value: 18.7, label: 'vs last month' },
      icon: <TrendingUp className="h-5 w-5" />,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your business."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-base font-medium text-text-primary mb-4">Recent Invoices</h3>
          <div className="text-center py-8 text-text-tertiary">No recent invoices</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-base font-medium text-text-primary mb-4">Pending Approvals</h3>
          <div className="text-center py-8 text-text-tertiary">No pending approvals</div>
        </Card>
      </div>
    </div>
  )
}