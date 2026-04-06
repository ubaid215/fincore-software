import type { ID, Timestamps } from '@/shared/types'

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN'
export type PayrunStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'POSTED' | 'CANCELLED'

export interface Employee extends Timestamps {
  id: ID
  employeeCode: string
  userId?: ID
  organizationId: ID
  firstName: string
  lastName: string
  email: string
  phone?: string
  department: string
  position: string
  employmentType: EmploymentType
  hireDate: string
  terminationDate?: string
  isActive: boolean
  bankName?: string
  bankAccount?: string
  taxId?: string
  salary: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface PayrunEmployee {
  employeeId: string
  employeeName: string
  employeeCode: string
  basicSalary: number
  allowances: number
  deductions: number
  tax: number
  netPay: number
}

export interface Payrun extends Timestamps {
  id: ID
  payrunNumber: string
  organizationId: ID
  periodStart: string
  periodEnd: string
  paymentDate: string
  status: PayrunStatus
  totalEmployees: number
  totalBasicSalary: number
  totalAllowances: number
  totalDeductions: number
  totalTax: number
  totalNetPay: number
  employees: PayrunEmployee[]
  createdBy: ID
  createdByName: string
  postedAt?: string
  postedBy?: ID
  createdAt: string
  updatedAt: string
}

export interface CreateEmployeeRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  department: string
  position: string
  employmentType: EmploymentType
  hireDate: string
  salary: number
  currency: string
  bankName?: string
  bankAccount?: string
  taxId?: string
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  id: ID
}

export interface CreatePayrunRequest {
  periodStart: string
  periodEnd: string
  paymentDate: string
  employeeIds: string[]
}

export interface EmployeeFilters {
  department?: string
  employmentType?: EmploymentType
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
}