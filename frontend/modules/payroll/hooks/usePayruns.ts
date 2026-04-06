import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollApi } from '../api/payroll.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function usePayruns(orgId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.payruns.list(orgId),
    queryFn: ({ pageParam = 1 }) => payrollApi.listPayruns(orgId, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.data.meta
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000,
    enabled: !!orgId,
  })
}

export function usePayrun(orgId: string, id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payruns.detail(orgId, id!),
    queryFn: () => payrollApi.getPayrun(orgId, id!),
    enabled: !!orgId && !!id,
    staleTime: 30_000,
  })
}

export function useCreatePayrun(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: Parameters<typeof payrollApi.createPayrun>[1]) =>
      payrollApi.createPayrun(orgId, data),
    onSuccess: (response) => {
      const payrun = response.data
      queryClient.invalidateQueries({
        queryKey: queryKeys.payruns.all(orgId),
      })
      toast.success('Payrun created successfully')
      router.push(`/dashboard/${orgId}/payroll/payruns/${payrun.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create payrun')
    },
  })
}

export function useProcessPayrun(orgId: string, payrunId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => payrollApi.processPayrun(orgId, payrunId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.payruns.detail(orgId, payrunId),
      })
      toast.success('Payrun processed successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process payrun')
    },
  })
}

export function usePostPayrun(orgId: string, payrunId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => payrollApi.postPayrun(orgId, payrunId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.payruns.all(orgId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.payruns.detail(orgId, payrunId),
      })
      toast.success('Payrun posted to ledger')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post payrun')
    },
  })
}