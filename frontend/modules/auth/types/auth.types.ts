import type { AuthUser, OrganizationMembership, AuthTokens } from '@/shared/types'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: AuthUser
  tokens: AuthTokens
  memberships: OrganizationMembership[]
}

export interface SignupRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface SignupResponse {
  user: AuthUser
  tokens: AuthTokens
  memberships: OrganizationMembership[]
}

export interface InviteAcceptRequest {
  token: string
  password: string
  firstName: string
  lastName: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number
}