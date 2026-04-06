import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { journalApi } from '../api/journal.api'
import { queryKeys } from '@/shared/lib/query-keys'
import { toast } from '@/shared/ui'

export function useCreateJournalEntry(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: Parameters<typeof journalApi.create>[1]) =>
      journalApi.create(orgId, data),
    onSuccess: (response) => {
      const entry = response.data
      queryClient.invalidateQueries({
        queryKey: queryKeys.journal.all(orgId),
      })
      toast.success('Journal entry created successfully')
      router.push(`/dashboard/${orgId}/journal/${entry.id}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create journal entry')
    },
  })
}