'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { payrunFormSchema, type PayrunFormData } from '../types/employee.schema'
import { useCreatePayrun } from '../hooks/usePayruns'
import { useEmployees } from '../hooks/useEmployees'
import { Button, Input, Card, PageHeader, Checkbox } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'

const steps = ['Select Period', 'Select Employees', 'Review']

export function PayrunWizard() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])

  const { data: employeesData } = useEmployees(orgId, { isActive: true })
  const employees = employeesData?.pages.flatMap(page => page.data.data) ?? []
  const createPayrun = useCreatePayrun(orgId)

  const form = useForm<PayrunFormData>({
    resolver: zodResolver(payrunFormSchema),
    defaultValues: {
      periodStart: '',
      periodEnd: '',
      paymentDate: '',
      employeeIds: [],
    },
  })

  const handleNext = () => {
    if (currentStep === 0) {
      const { periodStart, periodEnd, paymentDate } = form.getValues()
      if (!periodStart || !periodEnd || !paymentDate) return
      setCurrentStep(1)
    } else if (currentStep === 1) {
      if (selectedEmployeeIds.length === 0) return
      form.setValue('employeeIds', selectedEmployeeIds)
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const onSubmit = (data: PayrunFormData) => {
    createPayrun.mutate(data)
  }

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const selectedEmployees = employees.filter(e => selectedEmployeeIds.includes(e.id))
  const totalSalary = selectedEmployees.reduce((sum, e) => sum + e.salary, 0)

  return (
    <div>
      <PageHeader
        title="Create Payrun"
        description="Process monthly payroll for employees"
      />

      <div className="mt-6">
        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  index <= currentStep
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-tertiary'
                )}
              >
                {index < currentStep ? <CheckCircle className="h-5 w-5" /> : index + 1}
              </div>
              <span
                className={cn(
                  'ml-2 text-sm',
                  index <= currentStep ? 'text-text-primary' : 'text-text-tertiary'
                )}
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <div className="mx-4 h-px w-12 bg-border" />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Step 1: Period Selection */}
          {currentStep === 0 && (
            <Card>
              <div className="space-y-6">
                <Input
                  label="Period Start Date"
                  type="date"
                  error={form.formState.errors.periodStart?.message}
                  {...form.register('periodStart')}
                />
                <Input
                  label="Period End Date"
                  type="date"
                  error={form.formState.errors.periodEnd?.message}
                  {...form.register('periodEnd')}
                />
                <Input
                  label="Payment Date"
                  type="date"
                  error={form.formState.errors.paymentDate?.message}
                  {...form.register('paymentDate')}
                />
              </div>
            </Card>
          )}

          {/* Step 2: Employee Selection */}
          {currentStep === 1 && (
            <Card>
              <div className="space-y-4">
                <p className="text-sm text-text-tertiary">
                  Select employees to include in this payrun
                </p>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedEmployeeIds.includes(employee.id)}
                          onCheckedChange={() => toggleEmployee(employee.id)}
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {employee.position} • {employee.department}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-text-primary">
                        {formatCurrency(employee.salary, employee.currency)}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedEmployeeIds.length === 0 && (
                  <p className="text-center text-sm text-danger">
                    Please select at least one employee
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Step 3: Review */}
          {currentStep === 2 && (
            <Card>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-text-primary">Period</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {form.watch('periodStart')} to {form.watch('periodEnd')}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">Payment Date</h3>
                  <p className="mt-1 text-sm text-text-secondary">{form.watch('paymentDate')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">Employees ({selectedEmployees.length})</h3>
                  <div className="mt-2 space-y-1">
                    {selectedEmployees.map((emp) => (
                      <div key={emp.id} className="flex justify-between text-sm">
                        <span>{emp.firstName} {emp.lastName}</span>
                        <span>{formatCurrency(emp.salary, emp.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total Payroll</span>
                    <span>{formatCurrency(totalSalary, 'USD')}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="mt-6 flex justify-between">
            {currentStep > 0 && (
              <Button type="button" variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button type="button" onClick={handleNext} className="ml-auto">
                Next
              </Button>
            ) : (
              <Button type="submit" loading={createPayrun.isPending} className="ml-auto">
                Create Payrun
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}