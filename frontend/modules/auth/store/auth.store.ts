import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, OrganizationMembership } from '@/shared/types'

interface AuthState {
  // State
  user: AuthUser | null
  accessToken: string | null
  userMemberships: OrganizationMembership[] | null
  activeOrganizationId: string | null
  isInitialized: boolean
  isLoading: boolean

  // Actions
  setUser: (user: AuthUser | null) => void
  setAccessToken: (token: string | null) => void
  setUserMemberships: (memberships: OrganizationMembership[] | null) => void
  setActiveOrganizationId: (orgId: string | null) => void
  setInitialized: (initialized: boolean) => void
  setLoading: (loading: boolean) => void
  clearAuth: () => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // State
      user: null,
      accessToken: null,
      userMemberships: null,
      activeOrganizationId: null,
      isInitialized: false,
      isLoading: false,

      // Actions
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUserMemberships: (userMemberships) => set({ userMemberships }),
      setActiveOrganizationId: (activeOrganizationId) => set({ activeOrganizationId }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          userMemberships: null,
          activeOrganizationId: null,
          isInitialized: false,
        }),
      logout: async () => {
        try {
          // Call logout API to clear HTTP-only cookie
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            accessToken: null,
            userMemberships: null,
            activeOrganizationId: null,
            isInitialized: false,
          })
          // Clear localStorage
          localStorage.removeItem('fincore:activeOrgId')
        }
      },
    }),
    {
      name: 'fincore:auth',
      partialize: (state) => ({
        user: state.user,
        userMemberships: state.userMemberships,
        activeOrganizationId: state.activeOrganizationId,
      }),
    },
  ),
)