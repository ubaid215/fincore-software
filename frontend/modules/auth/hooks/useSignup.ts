import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'

export function useSignup() {
  const router = useRouter()
  const { setUser, setAccessToken, setUserMemberships, setActiveOrganizationId } = useAuthStore()

  return useMutation({
    mutationFn: authApi.signup,
    onSuccess: (response) => {
      const { user, tokens, memberships } = response.data
      
      setUser(user)
      setAccessToken(tokens.accessToken)
      setUserMemberships(memberships)

      const defaultOrg = memberships.find((m) => m.isDefault) || memberships[0]
      if (defaultOrg) {
        setActiveOrganizationId(defaultOrg.organizationId)
        localStorage.setItem('fincore:activeOrgId', defaultOrg.organizationId)
        router.push(`/dashboard/${defaultOrg.organizationId}`)
      } else {
        router.push('/dashboard/select')
      }
    },
  })
}