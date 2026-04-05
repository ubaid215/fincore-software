import { apiClient } from '@/shared/lib/api-client'
import type {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  InviteAcceptRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenResponse,
} from '../types/auth.types'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data),

  signup: (data: SignupRequest) =>
    apiClient.post<SignupResponse>('/auth/signup', data),

  logout: () =>
    apiClient.post('/auth/logout', {}),

  refresh: () =>
    apiClient.post<RefreshTokenResponse>('/auth/refresh', {}),

  getMe: () =>
    apiClient.get<LoginResponse['user']>('/auth/me'),

  getMyOrganizations: () =>
    apiClient.get<LoginResponse['memberships']>('/auth/organizations'),

  acceptInvite: (data: InviteAcceptRequest) =>
    apiClient.post<LoginResponse>('/auth/invite/accept', data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post('/auth/forgot-password', data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post('/auth/reset-password', data),
}