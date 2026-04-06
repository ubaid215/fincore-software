'use client'

import { useParams, useRouter } from 'next/navigation'
import { Plus, Users, DollarSign, Calendar } from 'lucide-react'
import { useEmployees } from '@/modules/payroll'
import { EmployeeTable } from '@/modules/payroll'
import { Button, PageHeader, StatCard } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { features } from '@/config/app.config'

export default function PayrollPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data, isLoading } = useEmployees(orgId, { isActive: true })
  const employees = data?.pages.flatMap(page => page.data.data) ?? []

  const totalMonthlySalary = employees.reduce((sum, e) => sum + e.salary, 0)

  // Feature flag check
  if (!features.payroll) {
    return (
      <div className="py-12 text-center">
        <Users className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Payroll Module Coming Soon</h2>
        <p className="text-text-tertiary">This feature will be available in the next update.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Manage employees and process payroll"
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push(`/dashboard/${orgId}/payroll/payruns/new`)}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Create Payrun
            </Button>
            <Button onClick={() => router.push(`/dashboard/${orgId}/payroll/new`)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Employees"
          value={employees.length}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Monthly Payroll"
          value={formatCurrency(totalMonthlySalary)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Active Employees"
          value={employees.filter(e => e.isActive).length}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Employees Table */}
      <div className="mt-6">
        <EmployeeTable data={employees} isLoading={isLoading} />
      </div>
    </div>
  )
}