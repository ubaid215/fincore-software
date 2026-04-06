'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { journalEntryFormSchema, type JournalEntryFormData } from '../types/journal.schema'
import { useCreateJournalEntry } from '../hooks/useCreateJournalEntry'
import { useAccounts } from '../hooks/useAccounts'
import { validateJournalEntry } from '../utils/journal.validation'
import { Button, Input, Textarea, Card, PageHeader, Select } from '@/shared/ui'

export function JournalEntryForm() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const createEntry = useCreateJournalEntry(orgId)
  const { data: accounts } = useAccounts(orgId)

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<JournalEntryFormData>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: {
      entryDate: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      lines: [{ accountId: '', debit: null, credit: null, description: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  const lines = watch('lines')
  const { totalDebit, totalCredit, isValid, difference } = validateJournalEntry(
    lines.map(line => ({
      accountId: line.accountId,
      debit: line.debit || null,
      credit: line.credit || null,
      description: line.description,
    })) as any
  )

  const accountOptions = accounts?.data.map(acc => ({
    value: acc.id,
    label: `${acc.code} - ${acc.name}`,
  })) ?? []

  const onSubmit = (data: JournalEntryFormData) => {
    createEntry.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title="New Journal Entry"
        description="Create a manual journal entry"
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={createEntry.isPending} disabled={!isValid}>
              Create Entry
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="Entry Date"
              type="date"
              error={errors.entryDate?.message}
              {...register('entryDate')}
            />
            <Input
              label="Reference (Optional)"
              placeholder="Invoice #, PO #, etc."
              {...register('reference')}
            />
            <div className="sm:col-span-2">
              <Input
                label="Description"
                placeholder="Brief description of this journal entry"
                error={errors.description?.message}
                {...register('description')}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Journal Lines</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 text-sm font-medium text-text-tertiary">
              <div className="col-span-6">Account</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1"></div>
            </div>
            
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-6">
                  <Select
                    options={accountOptions}
                    value={watch(`lines.${index}.accountId`)}
                    onValueChange={(value) => register(`lines.${index}.accountId`).onChange({ target: { value } })}
                    error={errors.lines?.[index]?.accountId?.message}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register(`lines.${index}.debit`, { valueAsNumber: true })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register(`lines.${index}.credit`, { valueAsNumber: true })}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button type="button" variant="ghost" size="sm" onClick={() => append({ accountId: '', debit: null, credit: null, description: '' })}>
              <Plus className="mr-1 h-4 w-4" />
              Add Line
            </Button>
          </div>

          {/* Balance Indicator */}
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Total Debits:</span>
                  <span className="font-mono">{totalDebit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Total Credits:</span>
                  <span className="font-mono">{totalCredit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
                  <span className={isValid ? 'text-success-text' : 'text-danger-text'}>
                    {isValid ? '✓ Balanced' : `Difference: ${difference.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <Textarea
            label="Memo (Optional)"
            placeholder="Additional notes about this journal entry"
            {...register('reference')}
          />
        </Card>
      </div>
    </form>
  )
}