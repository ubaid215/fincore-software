// modules/auth/hooks/useInitSession.ts
//
// Called once on mount from Providers.tsx (inside QueryClientProvider).
// Restores session from the HttpOnly refresh cookie.
//
// Writes to BOTH stores so everything stays consistent:
//   - modules/auth/store (used by DashboardAuthGuard + apiClient interceptor)
//   - stores/auth.store (used by dashboard pages + lib/api.ts interceptor)
//
import { useEffect } from 'react'
import { useAuthStore as useModuleStore }    from '../store/auth.store'
import { useAuthStore as useMainStore }      from '../../../stores/auth.store'
import { authApi as moduleAuthApi }          from '../api/auth.api'
import { authApi as mainAuthApi }            from '../../../lib/auth-api'

const ORG_KEY = 'fincore:activeOrgId'

function getSavedOrgId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ORG_KEY)
}

function saveOrgId(orgId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ORG_KEY, orgId)
}

export function useInitSession() {
  const moduleStore = useModuleStore()
  const mainStore   = useMainStore()

  useEffect(() => {
    let cancelled = false

    async function init() {
      moduleStore.setLoading(true)
      mainStore.setLoading(true)
      try {
        // 1. Refresh via Next.js BFF proxy — reads fincore_refresh cookie (port 3000),
        //    calls backend, rotates fincore_refresh so all future 401-interceptor
        //    refreshes find a valid token. Never call the backend directly here
        //    because that would rotate the backend cookie without updating fincore_refresh.
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
        if (!refreshRes.ok) throw new Error('Session expired')
        const { accessToken } = await refreshRes.json()
        if (!accessToken) throw new Error('No access token in refresh response')
        if (cancelled) return

        // ── Write access token to BOTH stores ────────────────────────────────
        moduleStore.setAccessToken(accessToken)
        mainStore.setAccessToken(accessToken)

        // 2. Load user profile + org memberships in parallel
        const [user, memberships] = await Promise.all([
          moduleAuthApi.getMe(),
          moduleAuthApi.getMyOrganizations(),
        ])
        if (cancelled) return

        // ── Write user data to BOTH stores ────────────────────────────────────
        moduleStore.setUser(user)
        moduleStore.setUserMemberships(memberships)

        // Map module memberships to the shape expected by main store
        const mainMemberships = memberships.map((m) => ({
          role:      m.role as any,
          isDefault: m.isDefault,
          joinedAt:  new Date().toISOString(),
          organization: {
            id:      m.organizationId,
            name:    m.organizationName,
            slug:    m.organizationSlug,
            status:  'ACTIVE' as const,
            logoUrl: null,
            subscription: null,
            appAccess: [],
          },
        }))
        mainStore.setUser(user as any)
        mainStore.setMemberships(mainMemberships)

        // 3. Restore org-scoped token for the main store
        if (memberships.length > 0) {
          const savedOrgId = getSavedOrgId()
          const targetMembership =
            (savedOrgId && memberships.find((m) => m.organizationId === savedOrgId)) ??
            memberships.find((m) => m.isDefault) ??
            memberships[0]

          if (targetMembership && !cancelled) {
            const orgId = targetMembership.organizationId

            // Get org-scoped token with plan + apps embedded
            const { accessToken: orgToken } = await mainAuthApi.selectOrg(orgId)
            if (!cancelled) {
              mainStore.setOrgToken(orgToken, orgId)
              moduleStore.setActiveOrganizationId(orgId)
              saveOrgId(orgId)
            }
          }
        }
      } catch {
        // No valid session — leave stores empty, guards will redirect
      } finally {
        if (!cancelled) {
          moduleStore.setLoading(false)
          moduleStore.setInitialized(true)
          mainStore.setLoading(false)
          mainStore.setHydrated(true)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
