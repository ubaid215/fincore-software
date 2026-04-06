'use client'

import { useParams } from 'next/navigation'
import { InvoiceForm } from '@/modules/invoicing'

export default function EditInvoicePage() {
  const params = useParams()
  const id = params.id as string

  return <InvoiceForm invoiceId={id} />
}