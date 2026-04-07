import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { env, API } from '@/config/app.config'
import type { ApiError } from '@/shared/types'

// Import store dynamically to avoid circular dependencies
import { useAuthStore } from '@/modules/auth/store/auth.store'

// ─── Token refresh queue ─────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject:  (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

// ─── Normalize API errors ────────────────────────────────────
function normalizeError(error: AxiosError): ApiError {
  const data = error.response?.data as Record<string, unknown> | undefined
  return {
    message:    (data?.message as string) ?? error.message ?? 'An unexpected error occurred',
    statusCode: error.response?.status ?? 0,
    errors:     data?.errors as Record<string, string[]> | undefined,
  }
}

// ─── Create axios instance ───────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL:         env.apiUrl,
  timeout:         API.timeout,
  withCredentials: true,    // sends HTTP-only refresh token cookie
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
})

// ─── Request interceptor ────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Access token from Zustand
    try {
      const { accessToken, activeOrganizationId } = useAuthStore.getState()

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      if (activeOrganizationId) {
        config.headers['x-organization-id'] = activeOrganizationId
      }
    } catch {
      // Store not initialized yet (e.g. during SSR)
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ─── Response interceptor — silent token refresh on 401 ──────
apiClient.interceptors.response.use(
  (response) => response.data,   // unwrap .data so callers don't need to
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue subsequent 401s while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Get refresh token from store
        const { refreshToken } = useAuthStore.getState()
        
        // Refresh endpoint uses the HTTP-only cookie automatically
        const { data } = await axios.post<{ accessToken: string }>(
          `${env.apiUrl}/auth/refresh`,
          { refreshToken },
          { withCredentials: true },
        )

        // Update store with new access token
        useAuthStore.getState().setAccessToken(data.accessToken)

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        
        // Process queued requests with the new token
        processQueue(null, data.accessToken)
        
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)

        // Refresh failed → log out
        useAuthStore.getState().clearAuth()

        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired'
        }
        return Promise.reject(normalizeError(refreshError as AxiosError))
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(normalizeError(error))
  },
)

export default apiClient