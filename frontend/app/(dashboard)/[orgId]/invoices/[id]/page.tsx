'use client'

import { useParams } from 'next/navigation'
import { useInvoice, useSendInvoice, useRecordPayment, useVoidInvoice, InvoiceDetail } from '@/modules/invoicing'
import { InvoiceActions } from '@/modules/invoicing'
import { useState } from 'react'

export default function InvoiceDetailPage() {
  const params = useParams()
  const orgId = params.orgId as string
  const id = params.id as string

  const { data: invoice, isLoading } = useInvoice(orgId, id)
  const sendInvoice = useSendInvoice(orgId, id)
  const recordPayment = useRecordPayment(orgId, id)
  const voidInvoice = useVoidInvoice(orgId, id)

  const [showActions, setShowActions] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-tertiary">Invoice not found</p>
      </div>
    )
  }

  return (
    <>
      <InvoiceDetail
        invoice={invoice.data}
        onSend={() => setShowActions(true)}
        onRecordPayment={() => setShowActions(true)}
        onVoid={() => setShowActions(true)}
      />
      
      <InvoiceActions
        invoice={invoice.data}
        onSend={(data) => sendInvoice.mutate(data)}
        onRecordPayment={(data) => recordPayment.mutate(data)}
        onVoid={(reason) => voidInvoice.mutate(reason)}
      />
    </>
  )
}