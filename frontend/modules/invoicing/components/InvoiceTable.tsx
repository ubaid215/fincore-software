'use client'

import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Eye, Send, Receipt, Ban } from 'lucide-react'
import { DataGrid } from '@/shared/ui'
import { Button, Dropdown, Guard } from '@/shared/ui'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import type { Invoice } from '../types/invoice.types'

const columnHelper = createColumnHelper<Invoice>()

interface InvoiceTableProps {
  data: Invoice[]
  isLoading?: boolean
  onSend?: (invoice: Invoice) => void
  onRecordPayment?: (invoice: Invoice) => void
  onVoid?: (invoice: Invoice) => void
}

export function InvoiceTable({ data, isLoading, onSend, onRecordPayment, onVoid }: InvoiceTableProps) {
  const router = useRouter()

  const columns = [
    columnHelper.accessor('invoiceNumber', {
      header: 'Invoice #',
      cell: (info) => (
        <span className="font-mono text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('customerName', {
      header: 'Customer',
      cell: (info) => (
        <span className="text-text-primary">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('issueDate', {
      header: 'Issue Date',
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor('dueDate', {
      header: 'Due Date',
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor('total', {
      header: 'Amount',
      cell: (info) => formatCurrency(info.getValue(), info.row.original.currency),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <InvoiceStatusBadge status={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const invoice = info.row.original
        const canSend = invoice.status === 'DRAFT'
        const canRecordPayment = invoice.status === 'SENT'
        const canVoid = invoice.status !== 'VOID' && invoice.status !== 'PAID'

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/invoices/${invoice.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
              items={[
                {
                  label: 'View Details',
                  icon: <Eye className="h-4 w-4" />,
                  onClick: () => router.push(`/invoices/${invoice.id}`),
                },
                ...(canSend ? [{
                  label: 'Send Invoice',
                  icon: <Send className="h-4 w-4" />,
                  onClick: () => onSend?.(invoice),
                }] : []),
                ...(canRecordPayment ? [{
                  label: 'Record Payment',
                  icon: <Receipt className="h-4 w-4" />,
                  onClick: () => onRecordPayment?.(invoice),
                }] : []),
                ...(canVoid ? [{
                  label: 'Void Invoice',
                  icon: <Ban className="h-4 w-4" />,
                  onClick: () => onVoid?.(invoice),
                  destructive: true,
                }] : []),
              ]}
            />
          </div>
        )
      },
    }),
  ]

  return (
    <DataGrid
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyState={
        <div className="py-12 text-center">
          <p className="text-text-tertiary">No invoices found</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => router.push('/invoices/new')}
          >
            Create Invoice
          </Button>
        </div>
      }
    />
  )
}