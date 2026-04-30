// src/stores/auth.store.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';
import type {
  User, OrgMembership, OrgJwtPayload, AuthState,
} from '../types/auth';

interface AuthActions {
  // Token
  setAccessToken:  (token: string) => void;
  setOrgToken:     (token: string, orgId: string) => void;
  clearAuth:       () => void;

  // User data
  setUser:         (user: User) => void;
  setMemberships:  (memberships: OrgMembership[]) => void;

  // Org context
  setCurrentOrg:   (orgId: string) => void;

  // Loading
  setLoading:      (loading: boolean) => void;
  setHydrated:     (hydrated: boolean) => void;

  // Derived helpers
  isAuthenticated: () => boolean;
  getCurrentOrg:   () => OrgMembership | undefined;
}

const initialState: AuthState = {
  accessToken:  null,
  user:         null,
  currentOrgId: null,
  orgPayload:   null,
  memberships:  [],
  isLoading:    true,
  isHydrated:   false,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ── Token management ─────────────────────────────────────────────────

      setAccessToken: (token) => {
        set({ accessToken: token }, false, 'setAccessToken');
      },

      setOrgToken: (token, orgId) => {
        try {
          const payload = jwtDecode<OrgJwtPayload>(token);
          set(
            { accessToken: token, currentOrgId: orgId, orgPayload: payload },
            false,
            'setOrgToken',
          );
        } catch {
          set({ accessToken: token, currentOrgId: orgId }, false, 'setOrgToken');
        }
      },

      clearAuth: () => {
        set({ ...initialState, isLoading: false, isHydrated: true }, false, 'clearAuth');
      },

      // ── User ─────────────────────────────────────────────────────────────

      setUser: (user) => set({ user }, false, 'setUser'),

      setMemberships: (memberships) =>
        set({ memberships }, false, 'setMemberships'),

      // ── Org ──────────────────────────────────────────────────────────────

      setCurrentOrg: (orgId) =>
        set({ currentOrgId: orgId }, false, 'setCurrentOrg'),

      // ── Loading ──────────────────────────────────────────────────────────

      setLoading:  (isLoading)  => set({ isLoading },  false, 'setLoading'),
      setHydrated: (isHydrated) => set({ isHydrated }, false, 'setHydrated'),

      // ── Derived ──────────────────────────────────────────────────────────

      isAuthenticated: () => {
        const { accessToken, user } = get();
        return !!(accessToken && user);
      },

      getCurrentOrg: () => {
        const { currentOrgId, memberships } = get();
        return memberships.find((m) => m.organization.id === currentOrgId);
      },
    }),
    { name: 'fincore-auth' },
  ),
);

// ── Selector hooks (prevent unnecessary re-renders) ───────────────────────────

export const useAccessToken  = () => useAuthStore((s) => s.accessToken);
export const useUser         = () => useAuthStore((s) => s.user);
export const useCurrentOrgId = () => useAuthStore((s) => s.currentOrgId);
export const useOrgPayload   = () => useAuthStore((s) => s.orgPayload);
export const useMemberships  = () => useAuthStore((s) => s.memberships);
export const useIsLoading    = () => useAuthStore((s) => s.isLoading);
export const useIsHydrated   = () => useAuthStore((s) => s.isHydrated);
export const useIsAuth       = () => useAuthStore((s) => s.isAuthenticated());
export const useCurrentOrg   = () => useAuthStore((s) => s.getCurrentOrg());