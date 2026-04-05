'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider, ToastViewport } from '@/shared/ui'
import { queryClient } from '@/shared/lib/query-client'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  )
}