import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { payrollApi } from '../api/payroll.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useCreateEmployee(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: Parameters<typeof payrollApi.createEmployee>[1]) =>
      payrollApi.createEmployee(orgId, data),
    onSuccess: (response) => {
      const employee = response.data
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.all(orgId),
      })
      toast.success('Employee created successfully')
      router.push(`/dashboard/${orgId}/payroll/${employee.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create employee')
    },
  })
}