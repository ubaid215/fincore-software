'use client'

import { Badge } from '@/shared/ui'
import { getInvoiceStatusVariant } from '../utils/invoice.calculations'

interface InvoiceStatusBadgeProps {
  status: string
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const variant = getInvoiceStatusVariant(status)
  const label = statusLabels[status] || status
  
  return <Badge variant={variant}>{label}</Badge>
}