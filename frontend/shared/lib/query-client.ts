import { QueryClient } from '@tanstack/react-query'
import { CACHE_TTL } from '@/config/app.config'
import type { ApiError } from '@/shared/types'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            CACHE_TTL.invoices,   // conservative 30s default
        gcTime:               5 * 60 * 1000,         // 5 min garbage collect
        retry:                (failureCount, error) => {
          const apiError = error as ApiError
          // Don't retry on auth errors or client errors
          if (apiError.statusCode >= 400 && apiError.statusCode < 500) return false
          return failureCount < 2
        },
        retryDelay:           (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,    // ERP users don't need surprise refetches
        refetchOnReconnect:   true,
      },
      mutations: {
        retry: 0,    // Never retry mutations — they have side effects
      },
    },
  })
}

// Singleton for use in providers
export const queryClient = createQueryClient()