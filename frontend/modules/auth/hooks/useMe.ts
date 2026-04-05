import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'
import { queryKeys } from '@/shared/lib/query-keys'

export function useMe() {
  const { setUser, setUserMemberships, setInitialized, setLoading } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      setLoading(true)
      try {
        const [userRes, orgsRes] = await Promise.all([
          authApi.getMe(),
          authApi.getMyOrganizations(),
        ])
        
        setUser(userRes.data)
        setUserMemberships(orgsRes.data)
        setInitialized(true)
        
        return { user: userRes.data, memberships: orgsRes.data }
      } finally {
        setLoading(false)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })
}