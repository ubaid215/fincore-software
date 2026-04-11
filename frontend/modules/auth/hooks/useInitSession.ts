// modules/auth/hooks/useInitSession.ts
import { useEffect } from 'react'
import { useAuthStore } from '../store/auth.store'
import { authApi } from '../api/auth.api'

export function useInitSession() {
  const { setUser, setAccessToken, setUserMemberships, setInitialized, setLoading } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      try {
        // /auth/refresh hits the httpOnly cookie → returns new accessToken
        const { accessToken } = await authApi.refresh()
        if (cancelled) return

        setAccessToken(accessToken)

        // Fetch user + orgs in parallel
        const [user, memberships] = await Promise.all([
          authApi.getMe(),
          authApi.getMyOrganizations(),
        ])
        if (cancelled) return

        setUser(user)
        setUserMemberships(memberships)
      } catch {
        // No valid session — leave everything null, guards will redirect
      } finally {
        if (!cancelled) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}