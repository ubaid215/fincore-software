/**
 * modules/auth/store/auth.store.ts
 *
 * FIXES APPLIED:
 * 1. CRITICAL — `setRefreshToken` was completely missing. useLogin, useSignup,
 *    and useAcceptInvite all called `setRefreshToken(refreshToken)`. Each call
 *    threw "setRefreshToken is not a function", which aborted onSuccess mid-flight
 *    before the httpOnly cookie was ever set. The user appeared to be logged in
 *    briefly (accessToken was stored) but the cookie was never written, so every
 *    subsequent page load hit the proxy with no `fincore_refresh` cookie and got
 *    bounced to /login.
 *    Added as a deliberate no-op stub: the value is accepted (so all call sites
 *    compile and run without error) but never stored in JS memory — the refresh
 *    token lives exclusively in the httpOnly cookie.
 *
 * 2. `setActiveOrganizationId` called `localStorage` unconditionally — crashes
 *    on SSR with "localStorage is not defined". Wrapped with typeof window guard.
 *
 * 3. `DashboardAuthGuard` reads `store.initialized` (no "is" prefix) but the
 *    store only had `isInitialized`. The guard always saw `undefined` (falsy)
 *    and showed the spinner forever even after a successful session load.
 *    Fixed by keeping both names in sync via setInitialized.
 *
 * 4. Removed async `refreshSession` and `logout` methods from the store.
 *    Zustand stores hold state; async orchestration belongs in hooks.
 *    These are now handled by useLogout and the api-client 401 interceptor.
 */

import { create } from 'zustand'
import type { AuthUser, OrganizationMembership } from '@/shared/types'

interface AuthState {
  // ── State ─────────────────────────────────────────────────────────────────
  user:                  AuthUser | null
  accessToken:           string | null
  userMemberships:       OrganizationMembership[] | null
  activeOrganizationId:  string | null
  isInitialized:         boolean  // canonical
  initialized:           boolean  // alias — DashboardAuthGuard reads this name
  isLoading:             boolean

  // ── Actions ───────────────────────────────────────────────────────────────
  setUser:                 (user: AuthUser | null) => void
  setAccessToken:          (token: string | null) => void
  /**
   * Intentional no-op stub.
   * The refresh token must ONLY live in the httpOnly `fincore_refresh` cookie
   * set via POST /api/auth/set-refresh-token. It must never be stored in
   * JavaScript memory (XSS risk). This stub exists so useLogin / useSignup /
   * useAcceptInvite compile and run without "is not a function" crashes.
   */
  setRefreshToken:         (token: string | null) => void
  setUserMemberships:      (memberships: OrganizationMembership[] | null) => void
  setActiveOrganizationId: (orgId: string | null) => void
  setInitialized:          (initialized: boolean) => void
  setLoading:              (loading: boolean) => void
  clearAuth:               () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  user:                  null,
  accessToken:           null,
  userMemberships:       null,
  activeOrganizationId:  null,
  isInitialized:         false,
  initialized:           false,
  isLoading:             false,

  // ── Setters ───────────────────────────────────────────────────────────────
  setUser:        (user)        => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),

  // No-op stub — see JSDoc above
  setRefreshToken: (_token) => { /* intentionally empty */ },

  setUserMemberships: (userMemberships) => set({ userMemberships }),

  setActiveOrganizationId: (activeOrganizationId) => {
    if (typeof window !== 'undefined') {
      if (activeOrganizationId) {
        localStorage.setItem('fincore:activeOrgId', activeOrganizationId)
      } else {
        localStorage.removeItem('fincore:activeOrgId')
      }
    }
    set({ activeOrganizationId })
  },

  setInitialized: (value) =>
    set({ isInitialized: value, initialized: value }),

  setLoading: (isLoading) => set({ isLoading }),

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fincore:activeOrgId')
    }
    set({
      user:                  null,
      accessToken:           null,
      userMemberships:       null,
      activeOrganizationId:  null,
      isInitialized:         false,
      initialized:           false,
    })
  },
}))

// Sprint note: S5-auth-store — setRefreshToken stub, SSR guard, initialized alias