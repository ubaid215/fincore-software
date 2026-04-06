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
    apiClient.get<PaginatedResponse<Employee>>(`/organizations/${orgId}/payroll/employees`, {
      params: filters,
    }),

  getEmployee: (orgId: string, id: string) =>
    apiClient.get<Employee>(`/organizations/${orgId}/payroll/employees/${id}`),

  createEmployee: (orgId: string, data: CreateEmployeeRequest) =>
    apiClient.post<Employee>(`/organizations/${orgId}/payroll/employees`, data),

  updateEmployee: (orgId: string, id: string, data: UpdateEmployeeRequest) =>
    apiClient.patch<Employee>(`/organizations/${orgId}/payroll/employees/${id}`, data),

  deleteEmployee: (orgId: string, id: string) =>
    apiClient.delete(`/organizations/${orgId}/payroll/employees/${id}`),

  // Payruns
  listPayruns: (orgId: string, page?: number, limit?: number) =>
    apiClient.get<PaginatedResponse<Payrun>>(`/organizations/${orgId}/payroll/payruns`, {
      params: { page, limit },
    }),

  getPayrun: (orgId: string, id: string) =>
    apiClient.get<Payrun>(`/organizations/${orgId}/payroll/payruns/${id}`),

  createPayrun: (orgId: string, data: CreatePayrunRequest) =>
    apiClient.post<Payrun>(`/organizations/${orgId}/payroll/payruns`, data),

  processPayrun: (orgId: string, id: string) =>
    apiClient.post<Payrun>(`/organizations/${orgId}/payroll/payruns/${id}/process`, {}),

  postPayrun: (orgId: string, id: string) =>
    apiClient.post<Payrun>(`/organizations/${orgId}/payroll/payruns/${id}/post`, {}),

  cancelPayrun: (orgId: string, id: string) =>
    apiClient.post<Payrun>(`/organizations/${orgId}/payroll/payruns/${id}/cancel`, {}),
}