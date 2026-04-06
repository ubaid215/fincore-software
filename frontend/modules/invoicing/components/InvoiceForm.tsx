'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { invoiceFormSchema, type InvoiceFormData } from '../types/invoice.schema'
import { useCreateInvoice } from '../hooks/useCreateInvoice'
import { useUpdateInvoice } from '../hooks/useUpdateInvoice'
import { useInvoice } from '../hooks/useInvoice'
import { Button, Input, Textarea, Card, PageHeader } from '@/shared/ui'
import { CustomerSelect } from './CustomerSelect'
import { LineItemsGrid } from './LineItemsGrid'
import { DEFAULT_CURRENCY } from '@/config/app.config'

interface InvoiceFormProps {
  invoiceId?: string
}

export function InvoiceForm({ invoiceId }: InvoiceFormProps) {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data: invoice, isLoading: isLoadingInvoice } = useInvoice(orgId, invoiceId)
  const createInvoice = useCreateInvoice(orgId)
  const updateInvoice = useUpdateInvoice(orgId, invoiceId!)

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      currency: DEFAULT_CURRENCY,
      notes: '',
      terms: '',
      lineItems: [{ description: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 }],
    },
  })

  // Populate form when editing
  React.useEffect(() => {
    if (invoice) {
      form.reset({
        customerId: invoice.data.customerId,
        issueDate: invoice.data.issueDate.split('T')[0],
        dueDate: invoice.data.dueDate.split('T')[0],
        currency: invoice.data.currency,
        notes: invoice.data.notes || '',
        terms: invoice.data.terms || '',
        lineItems: invoice.data.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
        })),
      })
    }
  }, [invoice, form])

  const onSubmit = (data: InvoiceFormData) => {
    if (invoiceId) {
      updateInvoice.mutate(data)
    } else {
      createInvoice.mutate(data)
    }
  }

  if (isLoadingInvoice && invoiceId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <PageHeader
        title={invoiceId ? 'Edit Invoice' : 'New Invoice'}
        description={invoiceId ? 'Update invoice details' : 'Create a new invoice for your customer'}
        actions={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createInvoice.isPending || updateInvoice.isPending}
            >
              {invoiceId ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <CustomerSelect
              orgId={orgId}
              value={form.watch('customerId')}
              onChange={(value) => form.setValue('customerId', value)}
              error={form.formState.errors.customerId?.message}
            />
            <Input
              label="Issue Date"
              type="date"
              error={form.formState.errors.issueDate?.message}
              {...form.register('issueDate')}
            />
            <Input
              label="Due Date"
              type="date"
              error={form.formState.errors.dueDate?.message}
              {...form.register('dueDate')}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Line Items</h3>
          <LineItemsGrid form={form} currency={form.watch('currency')} />
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Additional Information</h3>
          <div className="space-y-4">
            <Textarea
              label="Notes"
              placeholder="Notes to customer..."
              {...form.register('notes')}
            />
            <Textarea
              label="Terms & Conditions"
              placeholder="Payment terms, late fees, etc..."
              {...form.register('terms')}
            />
          </div>
        </Card>
      </div>
    </form>
  )
}