'use client'

import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Eye, Edit, Trash2, Package } from 'lucide-react'
import { DataGrid, Button, Dropdown, Badge } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import type { Product } from '../types/inventory.types'

const columnHelper = createColumnHelper<Product>()

interface ProductTableProps {
  data: Product[]
  isLoading?: boolean
  onDelete?: (product: Product) => void
}

export function ProductTable({ data, isLoading, onDelete }: ProductTableProps) {
  const router = useRouter()

  const columns = [
    columnHelper.accessor('sku', {
      header: 'SKU',
      cell: (info) => (
        <span className="font-mono text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Product Name',
      cell: (info) => (
        <span className="font-medium text-text-primary">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
    }),
    columnHelper.accessor('unitPrice', {
      header: 'Unit Price',
      cell: (info) => formatCurrency(info.getValue()),
    }),
    columnHelper.accessor('currentStock', {
      header: 'Stock',
      cell: (info) => {
        const stock = info.getValue()
        const product = info.row.original
        const isLowStock = stock <= product.minStockLevel
        
        return (
          <div className="flex items-center gap-2">
            <span className={isLowStock ? 'text-danger' : 'text-text-primary'}>
              {stock} {product.unit}
            </span>
            {isLowStock && (
              <Badge variant="danger" className="text-xs">Low Stock</Badge>
            )}
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const product = info.row.original
        
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/inventory/${product.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
              items={[
                {
                  label: 'View Details',
                  icon: <Eye className="h-4 w-4" />,
                  onClick: () => router.push(`/inventory/${product.id}`),
                },
                {
                  label: 'Edit Product',
                  icon: <Edit className="h-4 w-4" />,
                  onClick: () => router.push(`/inventory/${product.id}/edit`),
                },
                {
                  label: 'Adjust Stock',
                  icon: <Package className="h-4 w-4" />,
                  onClick: () => {
                    // TODO: Open stock adjustment modal
                  },
                },
                {
                  divider: true,
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => onDelete?.(product),
                  destructive: true,
                },
              ]}
            />
          </div>
        )
      },
    }),
  ]

  return (
    <DataGrid
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyState={
        <div className="py-12 text-center">
          <p className="text-text-tertiary">No products found</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => router.push('/inventory/new')}
          >
            Add Product
          </Button>
        </div>
      }
    />
  )
}