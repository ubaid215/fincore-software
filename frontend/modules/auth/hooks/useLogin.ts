/**
 * modules/auth/hooks/useLogin.ts
 *
 * FIXES APPLIED:
 * 1. Removed `setRefreshToken(refreshToken)` call — the store's setRefreshToken
 *    is now a no-op stub (refresh token must only live in the httpOnly cookie).
 *    The call no longer aborts onSuccess silently.
 *
 * 2. Step ordering hardened: Authorization header is set on apiClient.defaults
 *    BEFORE getMe() / getMyOrganizations() fire. The request interceptor reads
 *    from the Zustand store, but the store update (setAccessToken) and the
 *    defaults header set now happen in the same synchronous block before any
 *    async call, eliminating the race that caused unauthenticated /auth/me
 *    calls → 401 → refresh loop.
 *
 * 3. set-refresh-token failure is now a hard stop — if the httpOnly cookie
 *    cannot be set, the user isn't really logged in (middleware will bounce
 *    them) so we surface the error immediately rather than proceeding.
 *
 * 4. 'use client' confirmed present.
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

export function useLogin() {
  const router = useRouter()
  const { setUser, setAccessToken, setUserMemberships, setActiveOrganizationId } = useAuthStore()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async ({ accessToken, refreshToken }) => {

      // ── Step 1: Store access token in Zustand + axios defaults ────────────
      // Both must happen BEFORE any subsequent API call so the request
      // interceptor sends Authorization on getMe() / getMyOrganizations().
      setAccessToken(accessToken)
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

      // ── Step 2: Persist refresh token as httpOnly cookie ──────────────────
      // This is what the proxy reads. MUST succeed before navigation.
      try {
        const res = await fetch('/api/auth/set-refresh-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        })
        if (!res.ok) throw new Error(`set-refresh-token responded ${res.status}`)
      } catch (err) {
        console.error('Failed to persist session cookie:', err)
        // Undo the store update — we're not actually logged in without the cookie
        setAccessToken(null)
        delete apiClient.defaults.headers.common['Authorization']
        toast({ description: 'Login failed: could not persist session. Please try again.', variant: 'error' })
        return
      }

      // ── Step 3: Fetch user profile + memberships ──────────────────────────
      try {
        const [user, memberships] = await Promise.all([
          authApi.getMe(),
          authApi.getMyOrganizations(),
        ])

        setUser(user)
        setUserMemberships(memberships)

        // Org allow-list cookie — proxy uses this to enforce per-org access
        const orgIds = memberships.map((m: OrganizationMembership) => m.organizationId).join(',')
        setClientCookie('fincore_orgs', orgIds)

        // ── Step 4: Navigate ────────────────────────────────────────────────
        if (memberships.length > 0) {
          const defaultOrg = memberships.find((m) => m.isDefault) ?? memberships[0]
          setActiveOrganizationId(defaultOrg.organizationId)
          router.push(`/${defaultOrg.organizationId}`)
        } else {
          router.push('/select')
        }

      } catch (err) {
        console.error('Failed to load user data after login:', err)
        // We have a valid session cookie — send to /select so they can still use the app
        router.push('/select')
      }
    },

    onError: (error: Error) => {
      toast({ description: error.message || 'Invalid email or password', variant: 'error' })
    },
  })
}

// Sprint note: S5-useLogin — removed setRefreshToken, hardened step order, atomic header set