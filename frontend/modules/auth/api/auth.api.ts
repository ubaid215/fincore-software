import { apiClient } from '@/shared/lib/api-client'
import type {
  LoginRequest,
  SignupRequest,
  InviteAcceptRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth.types'
import type { AuthUser, OrganizationMembership } from '@/shared/types'

// Backend wraps responses in { data: T, timestamp: string }
interface BackendResponse<T> {
  data: T
  timestamp: string
}

// Extract the actual data from backend wrapper
function unwrap<T>(response: BackendResponse<T> | T): T {
  // Check if response has a 'data' property (backend wrapper)
  if (response && typeof response === 'object' && 'data' in response && response.data) {
    return response.data as T
  }
  return response as T
}

export const authApi = {
  login: async (data: LoginRequest) => {
    const result = await apiClient.post<BackendResponse<{ accessToken: string; refreshToken: string }>>('/auth/login', data)
    return unwrap(result)
  },

  signup: async (data: SignupRequest) => {
    const result = await apiClient.post<BackendResponse<{ accessToken: string; refreshToken: string }>>('/auth/register', data)
    return unwrap(result)
  },

  logout: async () => {
    await apiClient.post('/auth/logout', {})
  },

  refresh: async () => {
    const result = await apiClient.post<BackendResponse<{ accessToken: string }>>('/auth/refresh', {})
    return unwrap(result)
  },

  getMe: async () => {
    const result = await apiClient.get<BackendResponse<AuthUser>>('/auth/me')
    return unwrap(result)
  },

  getMyOrganizations: async () => {
    const result = await apiClient.get<BackendResponse<OrganizationMembership[]>>('/auth/organizations')
    return unwrap(result)
  },

  acceptInvite: async (data: InviteAcceptRequest) => {
    const result = await apiClient.post<BackendResponse<{ accessToken: string; refreshToken: string }>>('/auth/invite/accept', data)
    return unwrap(result)
  },

  forgotPassword: async (data: ForgotPasswordRequest) => {
    await apiClient.post('/auth/forgot-password', data)
  },

  resetPassword: async (data: ResetPasswordRequest) => {
    await apiClient.post('/auth/reset-password', data)
  },
}