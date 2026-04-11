// src/lib/auth-api.ts
// Typed wrappers for every auth endpoint.

import { apiPost, apiGet } from './api';
import type {
  LoginResponse, TokenPair, OrgTokenResponse, RegisterResponse,
  User, OrgMembership, OnboardOrgPayload,
} from '../types/auth';

// ── Registration ──────────────────────────────────────────────────────────────

export const authApi = {

  register: (payload: {
    email:     string;
    password:  string;
    firstName: string;
    lastName:  string;
    phone?:    string;
  }) => apiPost<RegisterResponse>('/auth/register', payload),

  verifyEmail: (token: string) =>
    apiPost<TokenPair>('/auth/verify-email', { token }),

  resendVerification: () =>
    apiPost<{ message: string }>('/auth/resend-verification'),

  // ── Login ───────────────────────────────────────────────────────────────────

  login: (payload: {
    email:       string;
    password:    string;
    mfaCode?:    string;
    deviceLabel?: string;
  }) => apiPost<LoginResponse>('/auth/login', payload),

  verifyMfa: (payload: {
    userId:      string;
    code:        string;
    deviceLabel?: string;
  }) => apiPost<TokenPair>('/auth/mfa/verify', payload),

  // ── Magic link ──────────────────────────────────────────────────────────────

  sendMagicLink: (email: string, deviceLabel?: string) =>
    apiPost<{ message: string }>('/auth/magic-link/send', { email, deviceLabel }),

  verifyMagicLink: (token: string) =>
    apiPost<TokenPair>('/auth/magic-link/verify', { token }),

  // ── Password reset ──────────────────────────────────────────────────────────

  forgotPassword: (email: string) =>
    apiPost<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiPost<{ message: string }>('/auth/reset-password', { token, newPassword }),

  // ── Token management ────────────────────────────────────────────────────────

  refresh: () =>
    apiPost<TokenPair>('/auth/refresh'),

  logout: (refreshToken: string) =>
    apiPost<{ message: string }>('/auth/logout', { refreshToken }),

  logoutAll: () =>
    apiPost<{ message: string }>('/auth/logout-all'),

  // ── Profile ─────────────────────────────────────────────────────────────────

  getMe: () =>
    apiGet<User>('/auth/me'),

  getOrganizations: () =>
    apiGet<OrgMembership[]>('/auth/organizations'),

  // ── Org selection ────────────────────────────────────────────────────────────

  selectOrg: (organizationId: string) =>
    apiPost<OrgTokenResponse>('/auth/select-org', { organizationId }),

  onboardOrg: (payload: OnboardOrgPayload) =>
    apiPost<OrgTokenResponse>('/auth/onboard-org', payload),

  // ── MFA management ──────────────────────────────────────────────────────────

  setupMfa: () =>
    apiPost<{ secret: string; qrCodeUrl: string }>('/auth/mfa/setup'),

  enableMfa: (code: string) =>
    apiPost<{ message: string; backupCodes: string[] }>('/auth/mfa/enable', { code }),

  disableMfa: (code: string) =>
    apiPost<{ message: string }>('/auth/mfa/disable', { code }),

  // ── Google OAuth ─────────────────────────────────────────────────────────────

  getGoogleAuthUrl: () =>
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'}/auth/google`,

  // ── Invites ──────────────────────────────────────────────────────────────────

  acceptInvite: (token: string) =>
    apiPost<{ joined: boolean; organizationId: string; role: string }>(
      '/invites/accept', { token },
    ),
};