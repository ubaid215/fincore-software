'use client'

import { useParams, useRouter } from 'next/navigation'
import { useExpense, useUpdateExpenseStatus, ExpenseApprovalPanel } from '@/modules/expenses'
import { ExpenseStatusBadge, ReceiptUpload } from '@/modules/expenses'
import { Card, PageHeader, Button } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { ArrowLeft } from 'lucide-react'

export default function ExpenseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const id = params.id as string

  const { data: expense, isLoading } = useExpense(orgId, id)
  const updateStatus = useUpdateExpenseStatus(orgId, id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-tertiary">Expense not found</p>
      </div>
    )
  }

  const e = expense.data
  const taxAmount = (e.amount * (e.taxRate || 0)) / 100
  const total = e.amount + taxAmount

  return (
    <div>
      <PageHeader
        title={`Expense ${e.expenseNumber}`}
        breadcrumbs={[
          { label: 'Expenses', href: '/expenses' },
          { label: e.expenseNumber },
        ]}
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="mt-6 space-y-6">
        {/* Approval Panel */}
        <ExpenseApprovalPanel
          expense={e}
          onSubmit={() => updateStatus.mutate({ type: 'submit' })}
          onApprove={(comment) => {
            if (e.status === 'SUBMITTED') {
              updateStatus.mutate({ type: 'approveManager', comment })
            } else if (e.status === 'MANAGER_APPROVED') {
              updateStatus.mutate({ type: 'approveFinance', comment })
            }
          }}
          onReject={(comment) => updateStatus.mutate({ type: 'reject', comment })}
          onPost={() => updateStatus.mutate({ type: 'post' })}
        />

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h3 className="mb-4 text-base font-medium text-text-primary">Expense Details</h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-text-tertiary">Category</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary capitalize">
                    {e.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-text-tertiary">Expense Date</dt>
                  <dd className="mt-1 text-sm text-text-primary">{formatDate(e.expenseDate)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-text-tertiary">Description</dt>
                  <dd className="mt-1 text-sm text-text-primary">{e.description}</dd>
                </div>
                {e.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-text-tertiary">Notes</dt>
                    <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{e.notes}</dd>
                  </div>
                )}
              </dl>
            </Card>

            {e.receiptUrl && (
              <Card>
                <h3 className="mb-3 text-base font-medium text-text-primary">Receipt</h3>
                {e.receiptUrl.endsWith('.pdf') ? (
                  <iframe src={e.receiptUrl} className="h-96 w-full rounded-md border border-border" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.receiptUrl} alt="Receipt" className="max-h-96 rounded-md border border-border" />
                )}
              </Card>
            )}

            {e.status === 'DRAFT' && (
              <Card>
                <h3 className="mb-3 text-base font-medium text-text-primary">Upload Receipt</h3>
                <ReceiptUpload
                  orgId={orgId}
                  expenseId={id}
                  onUploadComplete={() => {
                    // Refetch expense data
                    window.location.reload()
                  }}
                />
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <h3 className="mb-3 text-sm font-medium text-text-primary">Amount Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Amount</dt>
                  <dd>{formatCurrency(e.amount, e.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Tax ({e.taxRate}%)</dt>
                  <dd>{formatCurrency(taxAmount, e.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <dt className="text-text-primary">Total</dt>
                  <dd className="text-text-primary">{formatCurrency(total, e.currency)}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-medium text-text-primary">Status Information</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Status</dt>
                  <dd><ExpenseStatusBadge status={e.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Submitted By</dt>
                  <dd className="text-text-primary">{e.userName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Created</dt>
                  <dd className="text-text-primary">{formatDateTime(e.createdAt)}</dd>
                </div>
                {e.approvedAt && (
                  <div className="flex justify-between">
                    <dt className="text-text-tertiary">Approved</dt>
                    <dd className="text-text-primary">{formatDateTime(e.approvedAt)}</dd>
                  </div>
                )}
                {e.postedAt && (
                  <div className="flex justify-between">
                    <dt className="text-text-tertiary">Posted</dt>
                    <dd className="text-text-primary">{formatDateTime(e.postedAt)}</dd>
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}