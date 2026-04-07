'use client'

import { lazy, Suspense } from 'react'
import { PageHeader } from '@/shared/ui'

// Lazy load the entire reports dashboard
const ReportsDashboard = lazy(() => import('@/modules/reports').then(m => ({ default: m.ReportsDashboard })))

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial reports and analytics"
      />

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          }
        >
          <ReportsDashboard />
        </Suspense>
      </div>
    </div>
  )
}