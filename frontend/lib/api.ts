// src/lib/api.ts
import axios, {
  AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000/v1';

// ── Store accessors (no require, no circular dep) ─────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return useAuthStore.getState().accessToken;
}

function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  useAuthStore.getState().setAccessToken(token);
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  useAuthStore.getState().clearAuth();
}

// ── Refresh queue ─────────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown)  => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
}

// Refresh via the Next.js BFF proxy route.
// That route reads the `fincore_refresh` HttpOnly cookie (same domain) and
// calls the backend, rotating both the cookie and the access token.
async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<{
    accessToken: string;
    refreshToken?: string;
  }>(
    '/api/auth/refresh',   // Next.js BFF — reads fincore_refresh cookie
    {},
    { withCredentials: true },
  );

  const newAccessToken = response.data.accessToken;
  if (!newAccessToken) throw new Error('No accessToken in refresh response');

  // If the backend issued a new refresh token, rotate the fincore_refresh cookie
  const newRefreshToken = response.data.refreshToken;
  if (newRefreshToken) {
    fetch('/api/auth/set-refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: newRefreshToken }),
    }).catch(() => {/* best-effort */});
  }

  return newAccessToken;
}

// ── Axios instance ────────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true,
  timeout:         30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ───────────────────────────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!config.headers['X-Organization-Id']) {
    const orgId = useAuthStore.getState().currentOrgId;
    if (orgId) config.headers['X-Organization-Id'] = orgId;
  }

  return config;
});

// ── Response interceptor — silent token refresh on 401 ───────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const isAuthEndpoint = original.url?.includes('/auth/');
    const isUnauthorized = error.response?.status === 401;

    if (!isUnauthorized || isAuthEndpoint || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        original._retry  = true;
        return api(original);
      });
    }

    isRefreshing    = true;
    original._retry = true;

    try {
      const newToken = await refreshAccessToken();
      setAccessToken(newToken);
      processQueue(null, newToken);
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Typed wrappers ────────────────────────────────────────────────────────────

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<{ data: T }>(url, config);
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.post<{ data: T }>(url, body, config);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.patch<{ data: T }>(url, body, config);
  return res.data.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<{ data: T }>(url, config);
  return res.data.data;
}

export default api;
