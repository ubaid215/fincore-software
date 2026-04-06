import { z } from 'zod'
import { validateDoubleEntry } from '@/shared/utils/currency'

export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  debit: z.number().min(0).nullable().optional(),
  credit: z.number().min(0).nullable().optional(),
  description: z.string().optional(),
}).refine(
  (data) => {
    const hasDebit = data.debit && data.debit > 0
    const hasCredit = data.credit && data.credit > 0
    return (hasDebit || hasCredit) && !(hasDebit && hasCredit)
  },
  { message: 'Each line must have either a debit OR a credit, not both', path: ['debit'] }
)

export const journalEntryFormSchema = z.object({
  entryDate: z.string().min(1, 'Entry date is required'),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  lines: z.array(journalLineSchema).min(1, 'At least one line item is required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
    return validateDoubleEntry(data.lines as any)
  },
  { message: 'Total debits must equal total credits', path: ['lines'] }
)

export type JournalEntryFormData = z.infer<typeof journalEntryFormSchema>