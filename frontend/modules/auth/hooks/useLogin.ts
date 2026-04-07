import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'
import { toast } from '@/shared/hooks/useToast'

export function useLogin() {
  const router = useRouter()
  const { setUser, setAccessToken, setRefreshToken, setUserMemberships, setActiveOrganizationId } = useAuthStore()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (response) => {
      console.log('Login response:', response)
      
      const { accessToken, refreshToken } = response
      
      if (!accessToken) {
        console.error('No access token in response')
        toast({ description: 'Invalid server response', variant: 'error' })
        return
      }
      
      setAccessToken(accessToken)
      setRefreshToken(refreshToken)
      
      try {
        const user = await authApi.getMe()
        console.log('User profile:', user)
        setUser(user)
        
        const memberships = await authApi.getMyOrganizations()
        console.log('Organizations:', memberships)
        setUserMemberships(memberships)
        
        if (memberships && memberships.length > 0) {
          const defaultOrg = memberships.find((m) => m.isDefault) || memberships[0]
          if (defaultOrg) {
            setActiveOrganizationId(defaultOrg.organizationId)
            localStorage.setItem('fincore:activeOrgId', defaultOrg.organizationId)
            router.push(`/dashboard/${defaultOrg.organizationId}` as never)
          } else {
            router.push('/dashboard/select' as never)
          }
        } else {
          router.push('/dashboard/select' as never)
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
        router.push('/dashboard/select' as never)
      }
    },
    onError: (error: Error) => {
      const message = error.message || 'Login failed'
      toast({ description: message, variant: 'error' })
      console.error('Login error:', error)
    },
  })
}