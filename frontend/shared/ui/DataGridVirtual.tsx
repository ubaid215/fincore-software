'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Skeleton } from './Skeleton'

export interface DataGridVirtualProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  isLoading?: boolean
  estimateSize?: number
  overscan?: number
  sorting?: {
    state: SortingState
    onSortingChange: (sorting: SortingState) => void
  }
  filtering?: {
    state: ColumnFiltersState
    onFilteringChange: (filters: ColumnFiltersState) => void
  }
  rowHeight?: number
  emptyState?: React.ReactNode
  className?: string
  rowClassName?: (row: TData) => string
  onEndReached?: () => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  responsive?: boolean
}

export function DataGridVirtual<TData>({
  columns,
  data,
  isLoading = false,
  estimateSize = 48,
  overscan = 5,
  sorting,
  filtering,
  rowHeight = 48,
  emptyState,
  className,
  rowClassName,
  onEndReached,
  hasNextPage = false,
  isFetchingNextPage = false,
  responsive = true,
}: DataGridVirtualProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const [internalFilters, setInternalFilters] = useState<ColumnFiltersState>([])
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const useExternalSorting = !!sorting
  const useExternalFiltering = !!filtering

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: useExternalSorting ? sorting.onSortingChange : setInternalSorting,
    onColumnFiltersChange: useExternalFiltering ? filtering.onFilteringChange : setInternalFilters,
    state: {
      sorting: useExternalSorting ? sorting.state : internalSorting,
      columnFilters: useExternalFiltering ? filtering.state : internalFilters,
    },
  })

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? rows.length + 1 : rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  useEffect(() => {
    if (!onEndReached || !hasNextPage || isFetchingNextPage) return

    const lastIndex = rows.length - 1
    const virtualItems = rowVirtualizer.getVirtualItems()
    const lastVirtualItem = virtualItems[virtualItems.length - 1]

    if (lastVirtualItem && lastVirtualItem.index >= lastIndex - 1) {
      onEndReached()
    }
  }, [rows.length, rowVirtualizer.getVirtualItems(), onEndReached, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] sm:w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                    <Skeleton className="h-4 w-16 sm:w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, idx) => (
                <tr key={idx} className="border-b border-border">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-3 sm:px-4 py-2 sm:py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white">
        {emptyState || (
          <div className="py-8 sm:py-12 text-center">
            <p className="text-sm sm:text-base text-text-tertiary">No data available</p>
          </div>
        )}
      </div>
    )
  }

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  return (
    <div
      ref={tableContainerRef}
      className={cn(
        'rounded-lg border border-border bg-white overflow-auto',
        'touch-scroll',
        className
      )}
      style={{ height: '100%', maxHeight: '400px' }}
    >
      <div className={cn(responsive && 'min-w-[640px]')}>
        <table className={cn(!responsive && 'w-full')}>
          <thead className="sticky top-0 z-10 bg-surface border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider whitespace-nowrap"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer select-none hover:text-text-primary',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp className="h-3.5 w-3.5" />,
                          desc: <ChevronDown className="h-3.5 w-3.5" />,
                        }[header.column.getIsSorted() as string] ?? (
                          header.column.getCanSort() && <ChevronUp className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            <tr style={{ height: `${virtualRows[0]?.start ?? 0}px` }} />
            {virtualRows.map((virtualRow) => {
              const isLoaderRow = virtualRow.index > rows.length - 1
              const row = rows[virtualRow.index]

              if (isLoaderRow) {
                return (
                  <tr key={`loader-${virtualRow.index}`} className="border-b border-border">
                    <td colSpan={columns.length} className="px-3 sm:px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 py-2">
                        <div className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <span className="text-xs sm:text-sm text-text-tertiary">Loading more...</span>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-surface/50',
                    rowClassName?.(row.original),
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start - (virtualRows[0]?.start ?? 0)}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-text-secondary">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
            <tr style={{ height: `${totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)}px` }} />
          </tbody>
        </table>
      </div>
    </div>
  )
}