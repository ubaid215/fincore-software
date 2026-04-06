import { useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollApi } from '../api/payroll.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useUpdateEmployee(orgId: string, employeeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof payrollApi.updateEmployee>[2]) =>
      payrollApi.updateEmployee(orgId, employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.detail(orgId, employeeId),
      })
      toast.success('Employee updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update employee')
    },
  })
}