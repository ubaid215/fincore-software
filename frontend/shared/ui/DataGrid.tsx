'use client'

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Button } from './Button'
import { Select } from './Select'
import { Skeleton } from './Skeleton'

export interface DataGridProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  isLoading?: boolean
  pagination?: {
    pageSize: number
    pageIndex: number
    pageCount: number
    onPaginationChange: (pagination: PaginationState) => void
  }
  sorting?: {
    state: SortingState
    onSortingChange: (sorting: SortingState) => void
  }
  filtering?: {
    state: ColumnFiltersState
    onFilteringChange: (filters: ColumnFiltersState) => void
  }
  rowSelection?: {
    state: Record<string, boolean>
    onRowSelectionChange: (selection: Record<string, boolean>) => void
  }
  enableRowSelection?: boolean
  enableMultiRowSelection?: boolean
  emptyState?: React.ReactNode
  className?: string
  rowClassName?: (row: TData) => string
}

export function DataGrid<TData>({
  columns,
  data,
  isLoading = false,
  pagination,
  sorting,
  filtering,
  rowSelection,
  enableRowSelection = false,
  enableMultiRowSelection = false,
  emptyState,
  className,
  rowClassName,
}: DataGridProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [internalFilters, setInternalFilters] = useState<ColumnFiltersState>([])
  const [internalRowSelection, setInternalRowSelection] = useState<Record<string, boolean>>({})

  const useExternalSorting = !!sorting
  const useExternalPagination = !!pagination
  const useExternalFiltering = !!filtering
  const useExternalRowSelection = !!rowSelection

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: useExternalPagination ? getPaginationRowModel() : undefined,
    onSortingChange: useExternalSorting ? sorting.onSortingChange : setInternalSorting,
    onPaginationChange: useExternalPagination ? pagination.onPaginationChange : setInternalPagination,
    onColumnFiltersChange: useExternalFiltering ? filtering.onFilteringChange : setInternalFilters,
    onRowSelectionChange: useExternalRowSelection ? rowSelection.onRowSelectionChange : setInternalRowSelection,
    state: {
      sorting: useExternalSorting ? sorting.state : internalSorting,
      pagination: useExternalPagination ? { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize } : internalPagination,
      columnFilters: useExternalFiltering ? filtering.state : internalFilters,
      rowSelection: useExternalRowSelection ? rowSelection.state : internalRowSelection,
    },
    enableRowSelection,
    enableMultiRowSelection,
    manualPagination: useExternalPagination,
    pageCount: useExternalPagination ? pagination.pageCount : undefined,
  })

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="border-b border-border">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-4 py-3">
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

  // Empty state
  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white">
        {emptyState || (
          <div className="py-12 text-center">
            <p className="text-text-tertiary">No data available</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border bg-white overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider"
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-border transition-colors hover:bg-surface/50',
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-text-secondary">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {useExternalPagination && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-surface">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-tertiary">Rows per page</span>
            <Select
              options={[
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
                { value: '200', label: '200' },
              ]}
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                pagination.onPaginationChange({
                  pageIndex: 0,
                  pageSize: Number(value),
                })
              }}
              className="w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-tertiary">
              Page {pagination.pageIndex + 1} of {pagination.pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                pagination.onPaginationChange({
                  pageIndex: pagination.pageIndex - 1,
                  pageSize: pagination.pageSize,
                })
              }
              disabled={pagination.pageIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                pagination.onPaginationChange({
                  pageIndex: pagination.pageIndex + 1,
                  pageSize: pagination.pageSize,
                })
              }
              disabled={pagination.pageIndex + 1 >= pagination.pageCount}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}