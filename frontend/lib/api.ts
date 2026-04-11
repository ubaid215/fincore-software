// src/lib/api.ts


import axios, {
  AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig,
} from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

// ── Lazy import auth store to avoid circular deps ─────────────────────────────
// We use getState() at call time rather than subscribing at module load.
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Dynamic import would cause async issues in interceptors.
    // Instead we access the Zustand store's internal state directly.
    const { useAuthStore } = require('../stores/auth.store');
    return useAuthStore.getState().accessToken;
  } catch {
    return null;
  }
}

function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  const { useAuthStore } = require('../stores/auth.store');
  useAuthStore.getState().setAccessToken(token);
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  const { useAuthStore } = require('../stores/auth.store');
  useAuthStore.getState().clearAuth();
}

// ── Refresh queue — prevents multiple simultaneous refresh calls ───────────────
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

async function refreshAccessToken(): Promise<string> {
  // Call refresh endpoint — the HttpOnly cookie is sent automatically
  const response = await axios.post<{ data: { accessToken: string } }>(
    `${BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  return response.data.data.accessToken;
}

// ── Create instance ───────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true,       // sends HttpOnly refresh token cookie
  timeout:         30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor — inject access token + org header ────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Inject X-Organization-Id from URL or store if not already set
  if (!config.headers['X-Organization-Id']) {
    try {
      const { useAuthStore } = require('../stores/auth.store');
      const orgId = useAuthStore.getState().currentOrgId;
      if (orgId) config.headers['X-Organization-Id'] = orgId;
    } catch { /* noop */ }
  }

  return config;
});

// ── Response interceptor — silent refresh on 401 ─────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Only handle 401 on non-auth endpoints, and only retry once
    const isAuthEndpoint = original.url?.includes('/auth/');
    const isUnauthorized = error.response?.status === 401;

    if (!isUnauthorized || isAuthEndpoint || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        original._retry  = true;
        return api(original);
      });
    }

    isRefreshing     = true;
    original._retry  = true;

    try {
      const newToken = await refreshAccessToken();
      setAccessToken(newToken);
      processQueue(null, newToken);

      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      // Redirect to login — safe to do only in browser
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Typed API response unwrapper ─────────────────────────────────────────────
// Backend wraps all responses: { data: T, timestamp: string }

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