'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { expenseFormSchema, type ExpenseFormData } from '../types/expense.schema'
import { useCreateExpense } from '../hooks/useCreateExpense'
import { Button, Input, Textarea, Card, PageHeader, Select } from '@/shared/ui'
import { DEFAULT_CURRENCY } from '@/config/app.config'

const expenseCategories = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'other', label: 'Other' },
]

const currencies = [
  { value: 'PKR', label: 'PKR - Pakistani Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
]

export function ExpenseForm() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const createExpense = useCreateExpense(orgId)

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: '',
      description: '',
      expenseDate: new Date().toISOString().split('T')[0],
      amount: 0,
      taxRate: 0,
      currency: DEFAULT_CURRENCY,
      notes: '',
      lineItems: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const amount = watch('amount')
  const taxRate = watch('taxRate')
  const taxAmount = (amount * taxRate) / 100
  const total = amount + taxAmount

  const onSubmit = (data: ExpenseFormData) => {
    createExpense.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title="New Expense"
        description="Submit an expense for approval"
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={createExpense.isPending}>
              Submit Expense
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Category"
              options={expenseCategories}
              value={watch('category')}
              onValueChange={(value) => register('category').onChange({ target: { value } })}
              error={errors.category?.message}
            />
            <Input
              label="Expense Date"
              type="date"
              error={errors.expenseDate?.message}
              {...register('expenseDate')}
            />
            <Input
              label="Description"
              placeholder="What was this expense for?"
              error={errors.description?.message}
              {...register('description')}
            />
            <Select
              label="Currency"
              options={currencies}
              value={watch('currency')}
              onValueChange={(value) => register('currency').onChange({ target: { value } })}
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register('amount', { valueAsNumber: true })}
            />
            <Input
              label="Tax Rate (%)"
              type="number"
              step="0.1"
              placeholder="0"
              error={errors.taxRate?.message}
              {...register('taxRate', { valueAsNumber: true })}
            />
          </div>

          {/* Tax and Total Summary */}
          <div className="mt-4 flex justify-end border-t border-border pt-4">
            <div className="w-64 space-y-1 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Subtotal:</span>
                <span>{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-tertiary">Tax ({taxRate}%):</span>
                <span>{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span className="text-text-primary">Total:</span>
                <span>{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Line Items (Optional) */}
        {fields.length > 0 && (
          <Card>
            <h3 className="mb-4 text-base font-medium text-text-primary">Line Items</h3>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-3">
                  <Input
                    placeholder="Description"
                    className="flex-1"
                    {...register(`lineItems.${index}.description`)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    className="w-32"
                    {...register(`lineItems.${index}.amount`, { valueAsNumber: true })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <Textarea
            label="Notes (Optional)"
            placeholder="Any additional information about this expense..."
            {...register('notes')}
          />
        </Card>
      </div>
    </form>
  )
}