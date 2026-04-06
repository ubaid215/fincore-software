'use client'

import { useParams } from 'next/navigation'
import { EmployeeForm } from '@/modules/payroll'

export default function EditEmployeePage() {
  const params = useParams()
  const id = params.id as string

  return <EmployeeForm employeeId={id} />
}