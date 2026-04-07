'use client'

import { lazy, Suspense } from 'react'
import { PageHeader } from '@/shared/ui'

const PnLReport = lazy(() => import('@/modules/reports').then(m => ({ default: m.PnLReport })))

export default function ProfitLossPage() {
  return (
    <div>
      <PageHeader
        title="Profit & Loss Statement"
        description="Income and expenses over time"
      />

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          }
        >
          <PnLReport />
        </Suspense>
      </div>
    </div>
  )
}