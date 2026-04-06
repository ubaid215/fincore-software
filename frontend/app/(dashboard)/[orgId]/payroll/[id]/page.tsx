'use client'

import { useParams, useRouter } from 'next/navigation'
import { Pencil, ArrowLeft, UserCheck, UserX } from 'lucide-react'
import { useEmployee } from '@/modules/payroll'
import { Card, PageHeader, Button, Badge } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate, formatDateTime } from '@/shared/utils/date'

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const id = params.id as string

  const { data: employee, isLoading } = useEmployee(orgId, id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-tertiary">Employee not found</p>
      </div>
    )
  }

  const e = employee.data

  return (
    <div>
      <PageHeader
        title={`${e.firstName} ${e.lastName}`}
        breadcrumbs={[
          { label: 'Payroll', href: '/payroll' },
          { label: `${e.firstName} ${e.lastName}` },
        ]}
        actions={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => router.push(`/payroll/${id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="mb-4 text-base font-medium text-text-primary">Personal Information</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-text-tertiary">Full Name</dt>
                <dd className="mt-1 text-sm text-text-primary">{e.firstName} {e.lastName}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Email</dt>
                <dd className="mt-1 text-sm text-text-primary">{e.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Phone</dt>
                <dd className="mt-1 text-sm text-text-primary">{e.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Employee ID</dt>
                <dd className="mt-1 font-mono text-sm text-text-primary">{e.employeeCode}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-medium text-text-primary">Employment Information</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-text-tertiary">Department</dt>
                <dd className="mt-1 text-sm text-text-primary capitalize">{e.department}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Position</dt>
                <dd className="mt-1 text-sm text-text-primary">{e.position}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Employment Type</dt>
                <dd className="mt-1 text-sm text-text-primary">{e.employmentType.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Hire Date</dt>
                <dd className="mt-1 text-sm text-text-primary">{formatDate(e.hireDate)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-medium text-text-primary">Bank & Tax Information</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-text-tertiary">Bank Name</dt>
                <dd className="mt-1 text-sm text-text-primary">{e.bankName || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Bank Account</dt>
                <dd className="mt-1 font-mono text-sm text-text-primary">{e.bankAccount || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Tax ID / CNIC</dt>
                <dd className="mt-1 font-mono text-sm text-text-primary">{e.taxId || '—'}</dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Compensation</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Salary</dt>
                <dd className="font-semibold text-text-primary">{formatCurrency(e.salary, e.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Currency</dt>
                <dd>{e.currency}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Status</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Employment Status</dt>
                <dd>
                  <Badge variant={e.isActive ? 'success' : 'default'}>
                    {e.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
              {e.terminationDate && (
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Termination Date</dt>
                  <dd>{formatDate(e.terminationDate)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Metadata</h3>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Created</dt>
                <dd>{formatDateTime(e.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Last Updated</dt>
                <dd>{formatDateTime(e.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}