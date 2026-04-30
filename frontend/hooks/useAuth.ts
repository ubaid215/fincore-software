// src/hooks/useAuth.ts
'use client';

import { useCallback } from 'react';
import { useRouter }   from 'next/navigation';
import { authApi }     from '../lib/auth-api';
import { useAuthStore } from '../stores/auth.store';
import { isMfaRequired } from '../types/auth';
import type {
  LoginResponse, MfaRequiredResponse, TokenPair,
  OnboardOrgPayload,
} from '../types/auth';

// ── Persist refresh token as HttpOnly cookie via Next.js BFF ─────────────────
// The DashboardAuthGuard and middleware both read `fincore_refresh` to decide
// whether the user has an active session.  We call this after every login-style
// event so the cookie is always in sync with the access token in memory.
async function persistRefreshCookie(refreshToken: string): Promise<void> {
  try {
    const res = await fetch('/api/auth/set-refresh-token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      console.warn('set-refresh-token responded', res.status);
    }
  } catch (err) {
    console.warn('Failed to persist refresh cookie:', err);
  }
}

// ── Restore org context from localStorage after page reload ──────────────────
const ORG_KEY = 'fincore:activeOrgId';

function getSavedOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ORG_KEY);
}

function saveOrgId(orgId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ORG_KEY, orgId);
}

function clearSavedOrgId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ORG_KEY);
}

export function useAuth() {
  const router      = useRouter();
  const store       = useAuthStore();
  const {
    setUser, setMemberships, setAccessToken, setOrgToken,
    clearAuth, setLoading,
  } = store;

  // ── Hydration — called once on app boot from AuthProvider ────────────────
  // Restores the session from the HttpOnly refresh cookie, then re-selects
  // the previously active org so the org-scoped token is fully populated.

  const hydrate = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // 1. Exchange fincore_refresh cookie for a new access token via BFF proxy.
      //    The BFF reads fincore_refresh (port 3000 domain) and rotates it,
      //    so all future 401-interceptor refreshes find a valid cookie.
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!refreshRes.ok) throw new Error('Session expired');
      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.accessToken;
      if (!newAccessToken) throw new Error('No access token in refresh response');
      setAccessToken(newAccessToken);

      // 3. Load user profile + org list in parallel
      const [user, memberships] = await Promise.all([
        authApi.getMe(),
        authApi.getOrganizations(),
      ]);
      setUser(user);
      setMemberships(memberships);

      if (memberships.length === 0) return; // no org yet — stays on bare token

      // 4. Restore org-scoped token — prefer saved orgId, fallback to default/first
      const savedOrgId = getSavedOrgId();
      const targetOrg =
        (savedOrgId && memberships.find((m) => m.organization.id === savedOrgId)) ??
        memberships.find((m) => m.isDefault) ??
        memberships[0];

      if (targetOrg) {
        const orgId = targetOrg.organization.id;
        const { accessToken: orgToken } = await authApi.selectOrg(orgId);
        setOrgToken(orgToken, orgId);
        saveOrgId(orgId);
      }
    } catch {
      // No valid refresh cookie — user is logged out
      clearAuth();
      clearSavedOrgId();
    } finally {
      setLoading(false);
      useAuthStore.getState().setHydrated(true);
    }
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────

  const register = useCallback(async (payload: {
    email:     string;
    password:  string;
    firstName: string;
    lastName:  string;
    phone?:    string;
  }): Promise<{ userId: string; message: string }> => {
    return authApi.register(payload);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (payload: {
    email:       string;
    password:    string;
    mfaCode?:    string;
    deviceLabel?: string;
  }): Promise<LoginResponse> => {
    const result = await authApi.login(payload);
    if (isMfaRequired(result)) {
      return result;   // caller shows MFA form
    }
    await _handleTokenPair(result as TokenPair);
    return result;
  }, []);

  // ── MFA step-up ───────────────────────────────────────────────────────────

  const verifyMfa = useCallback(async (
    userId:      string,
    code:        string,
    deviceLabel?: string,
  ): Promise<void> => {
    const tokens = await authApi.verifyMfa({ userId, code, deviceLabel });
    await _handleTokenPair(tokens);
  }, []);

  // ── Magic link ────────────────────────────────────────────────────────────

  const verifyMagicLink = useCallback(async (token: string): Promise<void> => {
    const tokens = await authApi.verifyMagicLink(token);
    await _handleTokenPair(tokens);
  }, []);

  // ── Email verification ────────────────────────────────────────────────────

  const verifyEmail = useCallback(async (token: string): Promise<void> => {
    const tokens = await authApi.verifyEmail(token);
    await _handleTokenPair(tokens);
  }, []);

  // ── Org onboarding ────────────────────────────────────────────────────────

  const onboardOrg = useCallback(async (payload: OnboardOrgPayload): Promise<string> => {
    const { accessToken } = await authApi.onboardOrg(payload);
    const { jwtDecode } = await import('jwt-decode');
    const decoded = jwtDecode<{ orgId: string }>(accessToken);
    setOrgToken(accessToken, decoded.orgId);
    saveOrgId(decoded.orgId);
    return decoded.orgId;
  }, []);

  // ── Select org ────────────────────────────────────────────────────────────

  const selectOrg = useCallback(async (orgId: string): Promise<void> => {
    const { accessToken } = await authApi.selectOrg(orgId);
    setOrgToken(accessToken, orgId);
    saveOrgId(orgId);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    // Revoke all server sessions — best effort, must not block cookie clear
    try { await authApi.logoutAll(); } catch { /* ignore */ }
    // Always clear the HttpOnly cookie regardless of logoutAll result
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearAuth();
    clearSavedOrgId();
    // Hard navigation: bypasses React Router so no useEffect fires after clearAuth()
    // (prevents [orgId]/layout.tsx from detecting orgPayload===null and redirecting to /select)
    window.location.href = '/login';
  }, []);

  // ── Private: handle token pair ────────────────────────────────────────────
  // Called after every successful login-type event. Stores access token,
  // persists refresh token as HttpOnly cookie, loads user/org, then navigates.

  const _handleTokenPair = async (tokens: TokenPair & { refreshToken?: string }) => {
    setAccessToken(tokens.accessToken);

    // Persist refresh token so DashboardAuthGuard sees the session on reload
    if ((tokens as any).refreshToken) {
      await persistRefreshCookie((tokens as any).refreshToken);
    }

    try {
      const [user, memberships] = await Promise.all([
        authApi.getMe(),
        authApi.getOrganizations(),
      ]);
      setUser(user);
      setMemberships(memberships);

      if (memberships.length === 0) {
        router.push('/onboarding');
      } else if (memberships.length === 1) {
        const orgId = memberships[0].organization.id;
        const { accessToken: orgToken } = await authApi.selectOrg(orgId);
        setOrgToken(orgToken, orgId);
        saveOrgId(orgId);
        router.push(`/${orgId}`);
      } else {
        router.push('/select');
      }
    } catch (e) {
      console.error('_handleTokenPair failed', e);
    }
  };

  return {
    // State
    user:         store.user,
    isLoading:    store.isLoading,
    isHydrated:   store.isHydrated,
    currentOrgId: store.currentOrgId,
    memberships:  store.memberships,

    // Actions
    hydrate,
    register,
    login,
    verifyMfa,
    verifyMagicLink,
    verifyEmail,
    onboardOrg,
    selectOrg,
    logout,
  };
}
