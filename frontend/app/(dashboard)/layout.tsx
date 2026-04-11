// app/(dashboard)/layout.tsx


'use client'

import { Providers } from '@/components/Providers'
import { DashboardAuthGuard } from '@/modules/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <DashboardAuthGuard>{children}</DashboardAuthGuard>
    </Providers>
  )
}

// Sprint note: S5-dashboard-layout — added 'use client' directive