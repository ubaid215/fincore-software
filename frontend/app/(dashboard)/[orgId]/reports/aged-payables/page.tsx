'use client'

import { lazy, Suspense } from 'react'
import { PageHeader } from '@/shared/ui'

const AgedPayablesReport = lazy(() => import('@/modules/reports').then(m => ({ default: m.AgedPayablesReport })))

export default function AgedPayablesPage() {
  return (
    <div>
      <PageHeader
        title="Aged Payables"
        description="Outstanding vendor bills by age"
      />

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          }
        >
          <AgedPayablesReport />
        </Suspense>
      </div>
    </div>
  )
}