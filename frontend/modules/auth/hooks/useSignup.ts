/**
 * modules/auth/hooks/useSignup.ts
 *
 * FIXES APPLIED: same pattern as useLogin — same three root causes fixed.
 * 1. Removed setRefreshToken call (store no-op, was crashing).
 * 2. setAccessToken + axios defaults set BEFORE getMe() fires.
 * 3. set-refresh-token failure aborts with a clear error.
 */

'use client'

import { useMutation }                from '@tanstack/react-query'
import { useRouter }                  from 'next/navigation'
import { authApi }                    from '../api/auth.api'
import { useAuthStore }               from '../store/auth.store'
import { apiClient }                  from '@/shared/lib/api-client'
import { toast }                      from '@/shared/hooks/useToast'
import type { OrganizationMembership } from '@/shared/types'

function setClientCookie(name: string, value: string, maxAgeSecs = 7 * 24 * 60 * 60) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSecs}; SameSite=Lax`
}

export function useSignup() {
  const router = useRouter()
  const { setUser, setAccessToken, setUserMemberships, setActiveOrganizationId } = useAuthStore()

  return useMutation({
    mutationFn: authApi.signup,
    onSuccess: async ({ accessToken, refreshToken }) => {

      // Step 1: token into store + axios defaults (atomic, before any API call)
      setAccessToken(accessToken)
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

      // Step 2: httpOnly cookie
      try {
        const res = await fetch('/api/auth/set-refresh-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        })
        if (!res.ok) throw new Error(`set-refresh-token responded ${res.status}`)
      } catch (err) {
        console.error('Failed to persist session cookie:', err)
        setAccessToken(null)
        delete apiClient.defaults.headers.common['Authorization']
        toast({ description: 'Signup failed: could not persist session. Please try again.', variant: 'error' })
        return
      }

      // Step 3: fetch user + memberships
      try {
        const [user, memberships] = await Promise.all([
          authApi.getMe(),
          authApi.getMyOrganizations(),
        ])

        setUser(user)
        setUserMemberships(memberships)

        const orgIds = memberships.map((m: OrganizationMembership) => m.organizationId).join(',')
        setClientCookie('fincore_orgs', orgIds)

        // Step 4: navigate
        if (memberships.length > 0) {
          const defaultOrg: OrganizationMembership = memberships.find((m) => m.isDefault) ?? memberships[0]
          setActiveOrganizationId(defaultOrg.organizationId)
          router.push(`/${defaultOrg.organizationId}`)
        } else {
          router.push('/select')
        }
      } catch (err) {
        console.error('Failed to load user data after signup:', err)
        router.push('/select')
      }
    },

    onError: (error: Error) => {
      toast({ description: error.message || 'Failed to create account. Please try again.', variant: 'error' })
    },
  })
}

// Sprint note: S5-useSignup — same fixes as useLogin