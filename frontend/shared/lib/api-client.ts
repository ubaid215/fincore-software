/**
 * shared/lib/api-client.ts
 *
 * CRITICAL FIX:
 * The NestJS backend wraps every response in a global envelope:
 *   { data: T, timestamp: string, statusCode: number }
 *
 * Previous versions of this file returned either:
 *   (a) the full AxiosResponse — callers got { data: { data: T, timestamp } }
 *   (b) response.data — callers got { data: T, timestamp }
 *
 * In both cases, destructuring `{ accessToken, refreshToken }` from the result
 * returned `undefined` for both fields because the actual tokens were nested
 * inside `.data`. This caused `set-refresh-token` to receive
 * `{ refreshToken: undefined }` → 400 Bad Request on every login.
 *
 * Fix: the success interceptor now unwraps the envelope automatically.
 * If the response has a `.data` key (the NestJS wrapper), return `.data`.
 * Otherwise return the payload as-is (for endpoints that don't use the wrapper).
 * All callers receive plain T — no manual unwrap() needed anywhere.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { env, API }      from '@/config/app.config'
import type { ApiError } from '@/shared/types'
import { useAuthStore }  from '@/modules/auth/store/auth.store'

// ── Auth-route skip list ──────────────────────────────────────────────────────
// These paths must NEVER trigger the 401 → refresh loop.
const AUTH_SKIP_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/invite/accept',
]

function isAuthSkipRoute(url: string | undefined): boolean {
  if (!url) return false
  return AUTH_SKIP_PATHS.some((p) => url.includes(p))
}

// ── Refresh queue ─────────────────────────────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject:  (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else       reject(error)
  })
  failedQueue = []
}

// ── Envelope unwrap ───────────────────────────────────────────────────────────
// NestJS global response format: { data: T, timestamp: string, statusCode: number }
// If the payload has a top-level `data` key we unwrap it; otherwise pass through.
function unwrapEnvelope(payload: unknown): unknown {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'data' in (payload as object)
  ) {
    return (payload as { data: unknown }).data
  }
  return payload
}

// ── Error normalisation ───────────────────────────────────────────────────────
function normalizeError(error: AxiosError): ApiError {
  const raw  = error.response?.data as Record<string, unknown> | undefined
  // NestJS error responses: { message, statusCode, error } — NOT wrapped in .data
  const data = raw
  return {
    message:    (data?.message as string) ?? error.message ?? 'An unexpected error occurred',
    statusCode: error.response?.status   ?? 0,
    errors:     data?.errors as Record<string, string[]> | undefined,
  }
}

// ── Axios instance ────────────────────────────────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL:         env.apiUrl,
  timeout:         API.timeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
})

// ── Request interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const { accessToken, activeOrganizationId } = useAuthStore.getState()
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      if (activeOrganizationId) {
        config.headers['x-organization-id'] = activeOrganizationId
      }
    } catch {
      // Store not initialised (SSR) — safe to ignore
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap NestJS envelope: { data: T, timestamp, statusCode } → T
    return unwrapEnvelope(response.data)
  },

  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    if (!originalRequest) {
      return Promise.reject(error)
    }

    // Never refresh on auth routes
    if (isAuthSkipRoute(originalRequest.url)) {
      return Promise.reject(normalizeError(error))
    }

    // Silent token refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing            = true

      try {
        const res = await axios.post<{ data?: { accessToken: string; refreshToken?: string }; accessToken?: string; refreshToken?: string }>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        )

        // /api/auth/refresh is our own Next.js BFF route — it returns plain JSON
        // (not the NestJS envelope), so read accessToken directly from res.data
        const accessToken     = res.data?.data?.accessToken ?? res.data?.accessToken
        const newRefreshToken = res.data?.data?.refreshToken ?? res.data?.refreshToken

        if (!accessToken) throw new Error('No access token in refresh response')

        useAuthStore.getState().setAccessToken(accessToken)
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

        if (newRefreshToken) {
          fetch('/api/auth/set-refresh-token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ refreshToken: newRefreshToken }),
          }).catch(console.error)
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        processQueue(null, accessToken)

        return apiClient(originalRequest)

      } catch (refreshError: unknown) {
        processQueue(refreshError, null)
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

// ── Helpers ───────────────────────────────────────────────────────────────────
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete apiClient.defaults.headers.common['Authorization']
  }
}

export function clearAuthToken() {
  delete apiClient.defaults.headers.common['Authorization']
}

export default apiClient

// Sprint note: S5-api-client — envelope unwrap in interceptor, all callers receive plain T