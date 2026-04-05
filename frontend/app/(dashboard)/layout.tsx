'use client'

import { Providers } from '@/components/Providers'
import { useMe } from '@/modules/auth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoading } = useMe()

  if (isLoading) {
    return (
      <Providers>
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </Providers>
    )
  }

  return <Providers>{children}</Providers>
}