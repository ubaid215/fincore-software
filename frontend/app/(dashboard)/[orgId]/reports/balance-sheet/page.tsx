'use client'

import { lazy, Suspense } from 'react'
import { PageHeader } from '@/shared/ui'

const BalanceSheetReport = lazy(() => import('@/modules/reports').then(m => ({ default: m.BalanceSheetReport })))

export default function BalanceSheetPage() {
  return (
    <div>
      <PageHeader
        title="Balance Sheet"
        description="Financial position at a point in time"
      />

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          }
        >
          <BalanceSheetReport />
        </Suspense>
      </div>
    </div>
  )
}