'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { employeeFormSchema, type EmployeeFormData } from '../types/employee.schema'
import { useCreateEmployee } from '../hooks/useCreateEmployee'
import { useUpdateEmployee } from '../hooks/useUpdateEmployee'
import { useEmployee } from '../hooks/useEmployees'
import { Button, Input, Card, PageHeader, Select } from '@/shared/ui'
import { DEFAULT_CURRENCY } from '@/config/app.config'

const employmentTypes = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'INTERN', label: 'Intern' },
]

const departments = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'operations', label: 'Operations' },
]

const currencies = [
  { value: 'PKR', label: 'PKR - Pakistani Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
]

interface EmployeeFormProps {
  employeeId?: string
}

export function EmployeeForm({ employeeId }: EmployeeFormProps) {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data: employee, isLoading: isLoadingEmployee } = useEmployee(orgId, employeeId)
  const createEmployee = useCreateEmployee(orgId)
  const updateEmployee = useUpdateEmployee(orgId, employeeId!)

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      employmentType: 'FULL_TIME',
      hireDate: new Date().toISOString().split('T')[0],
      salary: 0,
      currency: DEFAULT_CURRENCY,
      bankName: '',
      bankAccount: '',
      taxId: '',
    },
  })

  React.useEffect(() => {
    if (employee) {
      form.reset({
        firstName: employee.data.firstName,
        lastName: employee.data.lastName,
        email: employee.data.email,
        phone: employee.data.phone || '',
        department: employee.data.department,
        position: employee.data.position,
        employmentType: employee.data.employmentType,
        hireDate: employee.data.hireDate.split('T')[0],
        salary: employee.data.salary,
        currency: employee.data.currency,
        bankName: employee.data.bankName || '',
        bankAccount: employee.data.bankAccount || '',
        taxId: employee.data.taxId || '',
      })
    }
  }, [employee, form])

  const onSubmit = (data: EmployeeFormData) => {
    if (employeeId) {
      updateEmployee.mutate(data)
    } else {
      createEmployee.mutate(data)
    }
  }

  if (isLoadingEmployee && employeeId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <PageHeader
        title={employeeId ? 'Edit Employee' : 'New Employee'}
        description={employeeId ? 'Update employee information' : 'Add a new employee to payroll'}
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={createEmployee.isPending || updateEmployee.isPending}>
              {employeeId ? 'Update Employee' : 'Create Employee'}
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Personal Information</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="First Name"
              error={form.formState.errors.firstName?.message}
              {...form.register('firstName')}
            />
            <Input
              label="Last Name"
              error={form.formState.errors.lastName?.message}
              {...form.register('lastName')}
            />
            <Input
              label="Email"
              type="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Input
              label="Phone"
              type="tel"
              {...form.register('phone')}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Employment Information</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Department"
              options={departments}
              value={form.watch('department')}
              onValueChange={(value) => form.setValue('department', value)}
              error={form.formState.errors.department?.message}
            />
            <Input
              label="Position"
              error={form.formState.errors.position?.message}
              {...form.register('position')}
            />
            <Select
              label="Employment Type"
              options={employmentTypes}
              value={form.watch('employmentType')}
              onValueChange={(value) => form.setValue('employmentType', value as any)}
            />
            <Input
              label="Hire Date"
              type="date"
              error={form.formState.errors.hireDate?.message}
              {...form.register('hireDate')}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Compensation</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="Salary"
              type="number"
              step="0.01"
              error={form.formState.errors.salary?.message}
              {...form.register('salary', { valueAsNumber: true })}
            />
            <Select
              label="Currency"
              options={currencies}
              value={form.watch('currency')}
              onValueChange={(value) => form.setValue('currency', value)}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Bank & Tax Information</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="Bank Name"
              {...form.register('bankName')}
            />
            <Input
              label="Bank Account"
              {...form.register('bankAccount')}
            />
            <Input
              label="Tax ID / CNIC"
              {...form.register('taxId')}
            />
          </div>
        </Card>
      </div>
    </form>
  )
}