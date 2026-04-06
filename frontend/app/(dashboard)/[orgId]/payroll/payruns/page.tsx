'use client'

import { useParams, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { usePayruns } from '@/modules/payroll'
import { Button, PageHeader, Card } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import { features } from '@/config/app.config'

export default function PayrunsPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data, isLoading } = usePayruns(orgId)
  const payruns = data?.pages.flatMap(page => page.data.data) ?? []

  if (!features.payroll) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-tertiary">Payroll module is not enabled</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Payruns"
        description="View and manage payroll runs"
        actions={
          <Button onClick={() => router.push(`/dashboard/${orgId}/payroll/payruns/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Payrun
          </Button>
        }
      />

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : payruns.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-text-tertiary">No payruns found</p>
          </Card>
        ) : (
          payruns.map((payrun) => (
            <Card key={payrun.id} className="cursor-pointer p-4 transition-shadow hover:shadow-md" onClick={() => router.push(`/payroll/payruns/${payrun.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium text-text-primary">{payrun.payrunNumber}</p>
                  <p className="mt-1 text-sm text-text-tertiary">
                    {formatDate(payrun.periodStart)} - {formatDate(payrun.periodEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-text-primary">{formatCurrency(payrun.totalNetPay)}</p>
                  <p className="text-xs text-text-tertiary">{payrun.totalEmployees} employees</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-text-tertiary">Payment Date: {formatDate(payrun.paymentDate)}</span>
                <span className="capitalize text-accent">{payrun.status}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}