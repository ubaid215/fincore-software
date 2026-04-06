'use client'

import { useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { PackagePlus, PackageMinus, RefreshCw } from 'lucide-react'
import { DataGridVirtual, Button, Modal, Input, Select, Badge } from '@/shared/ui'
import { useStockMovements, useAdjustStock } from '../hooks/useStockMovements'
import { formatDateTime } from '@/shared/utils/date'
import type { StockMovement, MovementType } from '../types/inventory.types'

const columnHelper = createColumnHelper<StockMovement>()

interface StockMovementsProps {
  orgId: string
  productId: string
  productName: string
}

const movementIcons: Record<MovementType, React.ReactNode> = {
  IN: <PackagePlus className="h-4 w-4 text-success" />,
  OUT: <PackageMinus className="h-4 w-4 text-danger" />,
  ADJUST: <RefreshCw className="h-4 w-4 text-warning" />,
}

const movementLabels: Record<MovementType, string> = {
  IN: 'Stock In',
  OUT: 'Stock Out',
  ADJUST: 'Adjustment',
}

export function StockMovements({ orgId, productId, productName }: StockMovementsProps) {
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustType, setAdjustType] = useState<MovementType>('IN')
  const [quantity, setQuantity] = useState(1)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useStockMovements(orgId, productId)
  const adjustStock = useAdjustStock(orgId)

  const movements = data?.pages.flatMap(page => page.data.data) ?? []

  const columns = [
    columnHelper.accessor('createdAt', {
      header: 'Date',
      cell: (info) => formatDateTime(info.getValue()),
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      cell: (info) => {
        const type = info.getValue()
        return (
          <div className="flex items-center gap-2">
            {movementIcons[type]}
            <span>{movementLabels[type]}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('quantity', {
      header: 'Quantity',
      cell: (info) => {
        const type = info.row.original.type
        const qty = info.getValue()
        return (
          <span className={type === 'IN' ? 'text-success' : type === 'OUT' ? 'text-danger' : 'text-warning'}>
            {type === 'IN' ? '+' : type === 'OUT' ? '-' : '±'} {qty}
          </span>
        )
      },
    }),
    columnHelper.accessor('previousStock', {
      header: 'Previous Stock',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('newStock', {
      header: 'New Stock',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('reference', {
      header: 'Reference',
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('userName', {
      header: 'By',
    }),
  ]

  const handleAdjustStock = () => {
    adjustStock.mutate({
      productId,
      quantity,
      type: adjustType,
      reference: reference || undefined,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setAdjustModalOpen(false)
        setQuantity(1)
        setReference('')
        setNotes('')
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-text-primary">Stock Movement History</h3>
        <Button size="sm" onClick={() => setAdjustModalOpen(true)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Adjust Stock
        </Button>
      </div>

      <DataGridVirtual
        columns={columns}
        data={movements}
        isLoading={isLoading}
        rowHeight={48}
        onEndReached={() => hasNextPage && fetchNextPage()}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        emptyState={
          <div className="py-12 text-center">
            <p className="text-text-tertiary">No stock movements recorded</p>
          </div>
        }
      />

      {/* Adjust Stock Modal */}
      <Modal
        open={adjustModalOpen}
        onOpenChange={setAdjustModalOpen}
        title="Adjust Stock"
        description={`Adjust stock level for ${productName}`}
      >
        <div className="space-y-4">
          <Select
            label="Adjustment Type"
            options={[
              { value: 'IN', label: 'Stock In (Add)' },
              { value: 'OUT', label: 'Stock Out (Remove)' },
              { value: 'ADJUST', label: 'Adjust (Set to exact quantity)' },
            ]}
            value={adjustType}
            onValueChange={(value) => setAdjustType(value as MovementType)}
          />
          <Input
            label="Quantity"
            type="number"
            step="1"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
          />
          <Input
            label="Reference (Optional)"
            placeholder="PO #, Invoice #, etc."
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Textarea
            label="Notes (Optional)"
            placeholder="Reason for adjustment..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustStock} loading={adjustStock.isPending}>
              Confirm Adjustment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}