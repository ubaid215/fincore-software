// modules/auth/api/auth.api.ts
//
// The api-client interceptor now unwraps the NestJS envelope automatically:
//   { data: T, timestamp, statusCode }  →  T
// So every call here receives plain T directly — no manual unwrap() needed.

import { apiClient }   from '@/shared/lib/api-client'
import type {
  LoginRequest,
  SignupRequest,
  InviteAcceptRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth.types'
import type { AuthUser, OrganizationMembership } from '@/shared/types'

// ── Response shapes ────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken:  string
  refreshToken: string
}

// GET /auth/organizations returns an array of these (after envelope unwrap)
// Matches OrganizationMembershipResponse in auth.service.ts
interface BackendOrgMembership {
  role:      string
  isDefault: boolean
  organization: {
    id:   string
    name: string
    slug: string
  }
}

export interface AcceptInviteResponse {
  user:        AuthUser
  tokens:      TokenPair
  memberships: OrganizationMembership[]
}

// ── Adapter ────────────────────────────────────────────────────────────────────
// Backend: { role, isDefault, organization: { id, name, slug } }
// Frontend: { organizationId, organizationName, organizationSlug, role, isDefault }

function adaptMembership(m: BackendOrgMembership): OrganizationMembership {
  return {
    organizationId:   m.organization.id,
    organizationName: m.organization.name,
    organizationSlug: m.organization.slug,
    role:             m.role,
    isDefault:        m.isDefault,
  }
}

// ── API surface ────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenPair> => {
    return apiClient.post<TokenPair>('/auth/login', data)
  },

  signup: async (data: SignupRequest): Promise<TokenPair> => {
    return apiClient.post<TokenPair>('/auth/register', data)
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout', {})
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    return apiClient.post('/auth/refresh', {})
  },

  getMe: async (): Promise<AuthUser> => {
    return apiClient.get<AuthUser>('/auth/me')
  },

  getMyOrganizations: async (): Promise<OrganizationMembership[]> => {
    const result = await apiClient.get<BackendOrgMembership[]>('/auth/organizations')
    // result is already unwrapped to BackendOrgMembership[] by the interceptor
    return Array.isArray(result) ? result.map(adaptMembership) : []
  },

  acceptInvite: async (data: InviteAcceptRequest): Promise<AcceptInviteResponse> => {
    return apiClient.post<AcceptInviteResponse>('/auth/invite/accept', data)
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<void> => {
    await apiClient.post('/auth/forgot-password', data)
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<void> => {
    await apiClient.post('/auth/reset-password', data)
  },
}

// Sprint note: S5-auth-api — no unwrap needed, interceptor handles envelope