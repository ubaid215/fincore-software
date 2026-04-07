'use client'

import { lazy, Suspense } from 'react'
import { PageHeader } from '@/shared/ui'

const CashFlowReport = lazy(() => import('@/modules/reports').then(m => ({ default: m.CashFlowReport })))

export default function CashFlowPage() {
  return (
    <div>
      <PageHeader
        title="Cash Flow Statement"
        description="Cash inflows and outflows"
      />

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          }
        >
          <CashFlowReport />
        </Suspense>
      </div>
    </div>
  )
}