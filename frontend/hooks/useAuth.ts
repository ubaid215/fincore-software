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

export function useAuth() {
  const router      = useRouter();
  const store       = useAuthStore();
  const {
    setUser, setMemberships, setAccessToken, setOrgToken,
    clearAuth, setLoading,
  } = store;

  // ── Hydration — called once on app boot from AuthProvider ────────────────

  const hydrate = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Try to restore access token from HttpOnly refresh cookie
      const tokens = await authApi.refresh();
      setAccessToken(tokens.accessToken);

      // Load user profile + org list
      const [user, memberships] = await Promise.all([
        authApi.getMe(),
        authApi.getOrganizations(),
      ]);
      setUser(user);
      setMemberships(memberships);
    } catch {
      // No valid refresh cookie — user is logged out
      clearAuth();
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
    const result = await authApi.register(payload);
    return result;
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (payload: {
    email:       string;
    password:    string;
    mfaCode?:    string;
    deviceLabel?: string;
  }): Promise<LoginResponse> => {
    const result = await authApi.login(payload);
    console.log('raw api result:', result);
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
    // The returned token is already org-scoped — extract orgId from it
    const { jwtDecode } = await import('jwt-decode');
    const decoded = jwtDecode<{ orgId: string }>(accessToken);
    setOrgToken(accessToken, decoded.orgId);
    return decoded.orgId;
  }, []);

  // ── Select org ────────────────────────────────────────────────────────────

  const selectOrg = useCallback(async (orgId: string): Promise<void> => {
    const { accessToken } = await authApi.selectOrg(orgId);
    setOrgToken(accessToken, orgId);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logoutAll();
    } catch { /* best effort */ }
    clearAuth();
    router.push('/login');
  }, [router]);

  // ── Private: handle token pair ────────────────────────────────────────────

const _handleTokenPair = async (tokens: TokenPair) => {
  console.log('_handleTokenPair called', tokens.accessToken?.slice(0, 20));
  setAccessToken(tokens.accessToken);
  try {
    const [user, memberships] = await Promise.all([
      authApi.getMe(),
      authApi.getOrganizations(),
    ]);
    console.log('user', user, 'memberships', memberships);
    setUser(user);
    setMemberships(memberships);

    if (memberships.length === 0) {
      router.push('/onboarding');
    } else if (memberships.length === 1) {
      const orgId = memberships[0].organization.id;
      await selectOrg(orgId);
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