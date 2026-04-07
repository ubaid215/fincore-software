'use client'

import { Providers } from '@/components/Providers'
import { useMe } from '@/modules/auth'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useMe()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <DashboardContent>{children}</DashboardContent>
    </Providers>
  )
}