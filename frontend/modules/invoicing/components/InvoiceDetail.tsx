'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Send, Receipt, Ban, ArrowLeft } from 'lucide-react'
import { Button, Card, PageHeader, Guard } from '@/shared/ui'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import { InvoiceTotals } from './InvoiceTotals'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { formatCurrency } from '@/shared/utils/currency'
import type { Invoice } from '../types/invoice.types'

interface InvoiceDetailProps {
  invoice: Invoice
  onSend?: () => void
  onRecordPayment?: () => void
  onVoid?: () => void
}

export function InvoiceDetail({ invoice, onSend, onRecordPayment, onVoid }: InvoiceDetailProps) {
  const router = useRouter()
  const canSend = invoice.status === 'DRAFT'
  const canRecordPayment = invoice.status === 'SENT'
  const canVoid = invoice.status !== 'VOID' && invoice.status !== 'PAID'
  const isEditable = invoice.status === 'DRAFT'

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        breadcrumbs={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoiceNumber },
        ]}
        actions={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {isEditable && (
              <Button
                variant="secondary"
                onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canSend && (
              <Button onClick={onSend}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            )}
            {canRecordPayment && (
              <Button onClick={onRecordPayment}>
                <Receipt className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            )}
            <Guard roles={['ADMIN', 'OWNER']}>
              {canVoid && (
                <Button variant="destructive" onClick={onVoid}>
                  <Ban className="mr-2 h-4 w-4" />
                  Void
                </Button>
              )}
            </Guard>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="mb-4 text-base font-medium text-text-primary">Invoice Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left text-sm text-text-tertiary">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-right w-24">Qty</th>
                    <th className="pb-2 font-medium text-right w-32">Unit Price</th>
                    <th className="pb-2 font-medium text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-border">
                      <td className="py-3 text-text-primary">{item.description}</td>
                      <td className="py-3 text-right text-text-secondary">{item.quantity}</td>
                      <td className="py-3 text-right text-text-secondary">
                        {formatCurrency(item.unitPrice, invoice.currency)}
                      </td>
                      <td className="py-3 text-right font-medium text-text-primary">
                        {formatCurrency(item.total || 0, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-80">
                <InvoiceTotals
                  subtotal={invoice.subtotal}
                  taxTotal={invoice.taxTotal}
                  total={invoice.total}
                  currency={invoice.currency}
                  amountPaid={invoice.amountPaid}
                  amountDue={invoice.amountDue}
                />
              </div>
            </div>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <Card>
              {invoice.notes && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-text-primary mb-1">Notes</h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h4 className="text-sm font-medium text-text-primary mb-1">Terms & Conditions</h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Invoice Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Status</dt>
                <dd><InvoiceStatusBadge status={invoice.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Issue Date</dt>
                <dd className="text-text-primary">{formatDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Due Date</dt>
                <dd className="text-text-primary">{formatDate(invoice.dueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Currency</dt>
                <dd className="text-text-primary">{invoice.currency}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Created</dt>
                <dd className="text-text-primary">{formatDateTime(invoice.createdAt)}</dd>
              </div>
              {invoice.updatedAt !== invoice.createdAt && (
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Last Updated</dt>
                  <dd className="text-text-primary">{formatDateTime(invoice.updatedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Customer Information</h3>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-text-tertiary">Name</dt>
                <dd className="text-text-primary font-medium">{invoice.customerName}</dd>
              </div>
              {invoice.customerEmail && (
                <div>
                  <dt className="text-text-tertiary">Email</dt>
                  <dd className="text-text-primary">{invoice.customerEmail}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}