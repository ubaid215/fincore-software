'use client'

import { useParams, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useInvoices } from '@/modules/invoicing'
import { InvoiceTable } from '@/modules/invoicing'
import { Button, PageHeader } from '@/shared/ui'

export default function InvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data, isLoading } = useInvoices(orgId)

  const invoices = data?.pages.flatMap(page => page.data.data) ?? []

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Manage and track all your invoices"
        actions={
          <Button onClick={() => router.push(`/dashboard/${orgId}/invoices/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        }
      />

      <div className="mt-6">
        <InvoiceTable
          data={invoices}
          isLoading={isLoading}
          onSend={(invoice) => {
            // TODO: Open send modal
            console.log('Send invoice:', invoice)
          }}
          onRecordPayment={(invoice) => {
            // TODO: Open payment modal
            console.log('Record payment:', invoice)
          }}
          onVoid={(invoice) => {
            // TODO: Open void confirmation
            console.log('Void invoice:', invoice)
          }}
        />
      </div>
    </div>
  )
}