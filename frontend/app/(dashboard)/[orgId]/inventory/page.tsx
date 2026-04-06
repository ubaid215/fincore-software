'use client'

import { useParams, useRouter } from 'next/navigation'
import { Plus, Package, TrendingUp, AlertTriangle } from 'lucide-react'
import { useProducts, useStockSummary, LowStockAlert } from '@/modules/inventory'
import { ProductTable } from '@/modules/inventory'
import { Button, PageHeader, StatCard } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { features } from '@/config/app.config'

export default function InventoryPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data, isLoading } = useProducts(orgId)
  const { data: summary } = useStockSummary(orgId)
  
  const products = data?.pages.flatMap(page => page.data.data) ?? []

  // Feature flag check
  if (!features.inventory) {
    return (
      <div className="py-12 text-center">
        <Package className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Inventory Module Coming Soon</h2>
        <p className="text-text-tertiary">This feature will be available in the next update.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Manage your products and stock levels"
        actions={
          <Button onClick={() => router.push(`/dashboard/${orgId}/inventory/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={summary?.data.totalProducts ?? 0}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title="Inventory Value"
          value={formatCurrency(summary?.data.totalValue ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Low Stock Items"
          value={summary?.data.lowStockCount ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          trend={summary?.data.lowStockCount ? { value: summary.data.lowStockCount, label: 'need attention' } : undefined}
        />
        <StatCard
          title="Out of Stock"
          value={summary?.data.outOfStockCount ?? 0}
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      {/* Low Stock Alert */}
      <div className="mt-6">
        <LowStockAlert orgId={orgId} />
      </div>

      {/* Products Table */}
      <div className="mt-6">
        <ProductTable data={products} isLoading={isLoading} />
      </div>
    </div>
  )
}