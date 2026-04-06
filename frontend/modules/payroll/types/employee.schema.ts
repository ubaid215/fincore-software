import { z } from 'zod'
import { DEFAULT_CURRENCY } from '@/config/app.config'

export const employeeFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN']),
  hireDate: z.string().min(1, 'Hire date is required'),
  salary: z.number().positive('Salary must be greater than 0'),
  currency: z.string().default(DEFAULT_CURRENCY),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  taxId: z.string().optional(),
})

export const payrunFormSchema = z.object({
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
})

export type EmployeeFormData = z.infer<typeof employeeFormSchema>
export type PayrunFormData = z.infer<typeof payrunFormSchema>