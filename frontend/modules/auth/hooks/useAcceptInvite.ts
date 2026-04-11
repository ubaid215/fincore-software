/**
 * modules/auth/hooks/useAcceptInvite.ts
 *
 * FIXES APPLIED: same root causes as useLogin.
 * 1. Was destructuring `response.data` — auth.api returns unwrapped payload now.
 * 2. Removed setRefreshToken call.
 * 3. Atomic token + header set before API calls.
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

export function useAcceptInvite() {
  const router = useRouter()
  const { setUser, setAccessToken, setUserMemberships, setActiveOrganizationId } = useAuthStore()

  return useMutation({
    mutationFn: authApi.acceptInvite,
    onSuccess: async (response) => {
      // api-client returns response.data directly — no .data wrapper
      const { user, tokens, memberships } = response

      // Step 1: atomic token set
      setUser(user)
      setAccessToken(tokens.accessToken)
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`

      // Step 2: httpOnly cookie
      try {
        const res = await fetch('/api/auth/set-refresh-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken: tokens.refreshToken }),
        })
        if (!res.ok) throw new Error(`set-refresh-token responded ${res.status}`)
      } catch (err) {
        console.error('Failed to persist session cookie after invite accept:', err)
        toast({ description: 'Session setup failed. Please log in.', variant: 'error' })
        router.push('/login')
        return
      }

      // Step 3: store memberships + cookies
      setUserMemberships(memberships)
      const orgIds = memberships.map((m: OrganizationMembership) => m.organizationId).join(',')
      setClientCookie('fincore_orgs', orgIds)

      // Step 4: navigate
      const defaultOrg = memberships.find((m) => m.isDefault) ?? memberships[0]
      if (defaultOrg) {
        setActiveOrganizationId(defaultOrg.organizationId)
        router.push(`/${defaultOrg.organizationId}`)
      } else {
        router.push('/select')
      }
    },

    onError: (error: Error) => {
      toast({ description: error.message || 'Failed to accept invite', variant: 'error' })
    },
  })
}

// Sprint note: S5-useAcceptInvite — same fixes as useLogin