'use client'

import { lazy, Suspense } from 'react'
import { PageHeader } from '@/shared/ui'

const AgedReceivablesReport = lazy(() => import('@/modules/reports').then(m => ({ default: m.AgedReceivablesReport })))

export default function AgedReceivablesPage() {
  return (
    <div>
      <PageHeader
        title="Aged Receivables"
        description="Outstanding customer invoices by age"
      />

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          }
        >
          <AgedReceivablesReport />
        </Suspense>
      </div>
    </div>
  )
}