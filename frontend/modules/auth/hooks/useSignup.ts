'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'
import { toast } from '@/shared/hooks/useToast'

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

      // Note: After registration, user might not have any organizations yet
      // You might need to redirect to a "Create Organization" page
      if (memberships && memberships.length > 0) {
        const defaultOrg = memberships.find((m) => m.isDefault) || memberships[0]
        if (defaultOrg) {
          setActiveOrganizationId(defaultOrg.organizationId)
          router.push(`/dashboard/${defaultOrg.organizationId}`)
        } else {
          router.push('/dashboard/select')
        }
      } else {
        // User has no organizations - redirect to create organization
        router.push('/organization/create')
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to create account'
      toast({ description: message, variant: 'error' })
      console.error('Signup error:', error.response?.data || error)
    },
  })
}