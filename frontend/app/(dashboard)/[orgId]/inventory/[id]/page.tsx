'use client'

import { useParams, useRouter } from 'next/navigation'
import { Pencil, ArrowLeft } from 'lucide-react'
import { useProduct, StockMovements } from '@/modules/inventory'
import { Card, PageHeader, Button, Badge } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const id = params.id as string

  const { data: product, isLoading } = useProduct(orgId, id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-tertiary">Product not found</p>
      </div>
    )
  }

  const p = product.data
  const isLowStock = p.currentStock <= p.minStockLevel

  return (
    <div>
      <PageHeader
        title={p.name}
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: p.name },
        ]}
        actions={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => router.push(`/inventory/${id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="mb-4 text-base font-medium text-text-primary">Product Details</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-text-tertiary">SKU</dt>
                <dd className="mt-1 font-mono text-sm text-text-primary">{p.sku}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Category</dt>
                <dd className="mt-1 text-sm text-text-primary capitalize">{p.category}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Unit</dt>
                <dd className="mt-1 text-sm text-text-primary">{p.unit}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-tertiary">Location</dt>
                <dd className="mt-1 text-sm text-text-primary">{p.location || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-text-tertiary">Description</dt>
                <dd className="mt-1 text-sm text-text-primary">{p.description || '—'}</dd>
              </div>
            </dl>
          </Card>

          <StockMovements orgId={orgId} productId={id} productName={p.name} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Pricing</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Unit Price</dt>
                <dd className="font-medium text-text-primary">{formatCurrency(p.unitPrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Cost Price</dt>
                <dd className="text-text-primary">{formatCurrency(p.costPrice)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-text-tertiary">Margin</dt>
                <dd className="font-medium text-success">
                  {((p.unitPrice - p.costPrice) / p.unitPrice * 100).toFixed(1)}%
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Stock Status</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Current Stock</dt>
                <dd className={cn('font-medium', isLowStock ? 'text-danger' : 'text-text-primary')}>
                  {p.currentStock} {p.unit}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Min Stock Level</dt>
                <dd>{p.minStockLevel} {p.unit}</dd>
              </div>
              {p.maxStockLevel && (
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Max Stock Level</dt>
                  <dd>{p.maxStockLevel} {p.unit}</dd>
                </div>
              )}
              {isLowStock && (
                <div className="mt-2">
                  <Badge variant="danger">Low Stock Alert</Badge>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-text-primary">Metadata</h3>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Created</dt>
                <dd>{formatDateTime(p.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Last Updated</dt>
                <dd>{formatDateTime(p.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}