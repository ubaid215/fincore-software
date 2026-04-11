'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider, ToastViewport } from '@/shared/ui'
import { useInitSession } from '@/modules/auth/hooks/useInitSession'

// ── Inner component so useInitSession runs inside QueryClientProvider ─────────
// (authApi uses apiClient which may depend on React Query internals)
function SessionInit() {
  useInitSession()
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionInit />
        {children}
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  )
}