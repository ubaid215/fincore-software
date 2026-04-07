'use client'

import { lazy, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent, Card, Skeleton } from '@/shared/ui'

// Lazy load report components for better performance
const PnLReport = lazy(() => import('./PnLReport'))
const BalanceSheetReport = lazy(() => import('./BalanceSheetReport'))
const CashFlowReport = lazy(() => import('./CashFlowReport'))
const AgedReceivablesReport = lazy(() => import('./AgedReceivablesReport'))
const AgedPayablesReport = lazy(() => import('./AgedPayablesReport'))

export function ReportsDashboard() {
  const params = useParams()
  const orgId = params.orgId as string

  return (
    <Tabs defaultValue="pnl">
      <TabsList className="flex-wrap gap-2">
        <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
        <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        <TabsTrigger value="receivables">Aged Receivables</TabsTrigger>
        <TabsTrigger value="payables">Aged Payables</TabsTrigger>
      </TabsList>

      <TabsContent value="pnl" className="mt-6">
        <Suspense fallback={<SkeletonCard />}>
          <PnLReport orgId={orgId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="balance" className="mt-6">
        <Suspense fallback={<SkeletonCard />}>
          <BalanceSheetReport orgId={orgId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="cashflow" className="mt-6">
        <Suspense fallback={<SkeletonCard />}>
          <CashFlowReport orgId={orgId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="receivables" className="mt-6">
        <Suspense fallback={<SkeletonCard />}>
          <AgedReceivablesReport orgId={orgId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="payables" className="mt-6">
        <Suspense fallback={<SkeletonCard />}>
          <AgedPayablesReport orgId={orgId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}

function SkeletonCard() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </Card>
  )
}