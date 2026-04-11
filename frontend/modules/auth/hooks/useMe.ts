/**
 * modules/auth/hooks/useMe.ts
 *
 * FIXES APPLIED:
 * 1. api-client now returns response.data directly — removed double-unwrap.
 * 2. Wrong cookie name fixed: fincore_refresh_token → fincore_refresh.
 * 3. Added `enabled` option so DashboardAuthGuard can suppress this call
 *    when no session cookie is present (prevents 401 loop on public pages).
 * 4. `setInitialized(true)` now also sets the `initialized` alias in the
 *    store (both names kept in sync inside the store itself).
 */

'use client'

import { useQuery }     from '@tanstack/react-query'
import { authApi }      from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'
import { queryKeys }    from '@/shared/lib/query-keys'
import type { OrganizationMembership } from '@/shared/types'

function setClientCookie(name: string, value: string, maxAgeSecs = 7 * 24 * 60 * 60) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSecs}; SameSite=Lax`
}

export function useMe(options?: { enabled?: boolean }) {
  const { setUser, setUserMemberships, setInitialized, setLoading } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.auth.me(),
    enabled:  options?.enabled ?? true,
    queryFn: async () => {
      setLoading(true)
      try {
        const [user, memberships] = await Promise.all([
          authApi.getMe(),
          authApi.getMyOrganizations(),
        ])

        setUser(user)
        setUserMemberships(memberships)
        setInitialized(true)  // sets both isInitialized and initialized in store

        // Re-hydrate client-readable cookies after hard page reload
        setClientCookie('fincore_authenticated', 'true')
        const orgIds = memberships
          .map((m: OrganizationMembership) => m.organizationId)
          .join(',')
        setClientCookie('fincore_orgs', orgIds)

        return { user, memberships }
      } finally {
        setLoading(false)
      }
    },
    staleTime: 5 * 60 * 1_000,
    retry:     false,
  })
}

// Sprint note: S5-useMe — enabled option, correct cookie name, aligned with plain response