import { apiClient } from '@/shared/lib/api-client'
import type {
  Employee,
  Payrun,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  CreatePayrunRequest,
  EmployeeFilters,
} from '../types/payroll.types'
import type { PaginatedResponse } from '@/shared/types'

export const payrollApi = {
  // Employees
  listEmployees: (orgId: string, filters?: EmployeeFilters) =>
    apiClient.get<PaginatedResponse<Employee>>(`/v1/payroll/employees`, {
      params: filters,
    }),

  getEmployee: (orgId: string, id: string) =>
    apiClient.get<Employee>(`/v1/payroll/employees/${id}`),

  createEmployee: (orgId: string, data: CreateEmployeeRequest) =>
    apiClient.post<Employee>(`/v1/payroll/employees`, data),

  updateEmployee: (orgId: string, id: string, data: UpdateEmployeeRequest) =>
    apiClient.patch<Employee>(`/v1/payroll/employees/${id}`, data),

  deleteEmployee: (orgId: string, id: string) =>
    apiClient.delete(`/v1/payroll/employees/${id}`),

  // Payruns
  listPayruns: (orgId: string, page?: number, limit?: number) =>
    apiClient.get<PaginatedResponse<Payrun>>(`/v1/payroll/payruns`, {
      params: { page, limit },
    }),

  getPayrun: (orgId: string, id: string) =>
    apiClient.get<Payrun>(`/v1/payroll/payruns/${id}`),

  createPayrun: (orgId: string, data: CreatePayrunRequest) =>
    apiClient.post<Payrun>(`/v1/payroll/payruns`, data),

  processPayrun: (orgId: string, id: string) =>
    apiClient.post<Payrun>(`/v1/payroll/payruns/${id}/process`, {}),

  postPayrun: (orgId: string, id: string) =>
    apiClient.post<Payrun>(`/v1/payroll/payruns/${id}/post`, {}),

  cancelPayrun: (orgId: string, id: string) =>
    apiClient.post<Payrun>(`/v1/payroll/payruns/${id}/cancel`, {}),
}