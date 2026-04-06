'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, Package } from 'lucide-react'
import { Card, Button, Badge } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { useLowStockProducts } from '../hooks/useProducts'

interface LowStockAlertProps {
  orgId: string
}

export function LowStockAlert({ orgId }: LowStockAlertProps) {
  const router = useRouter()
  const { data: products, isLoading } = useLowStockProducts(orgId)

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-48 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      </Card>
    )
  }

  if (!products?.data.length) {
    return null
  }

  return (
    <Card className="border-warning/20 bg-warning-subtle">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-warning-text">Low Stock Alert</h3>
          <p className="mt-1 text-sm text-warning-text/80">
            {products.data.length} product(s) are running low on stock
          </p>
          <div className="mt-3 space-y-2">
            {products.data.slice(0, 3).map((product) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5" />
                  <span>{product.name}</span>
                  <Badge variant="danger" className="text-xs">
                    {product.currentStock} {product.unit} left
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/inventory/${product.id}`)}
                >
                  View
                </Button>
              </div>
            ))}
            {products.data.length > 3 && (
              <p className="text-xs text-warning-text/60 mt-2">
                +{products.data.length - 3} more products
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}