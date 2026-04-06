'use client'

import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import { MoreHorizontal, Eye, Edit, Trash2, UserCheck, UserX } from 'lucide-react'
import { DataGrid, Button, Dropdown, Badge } from '@/shared/ui'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import type { Employee } from '../types/payroll.types'

const columnHelper = createColumnHelper<Employee>()

interface EmployeeTableProps {
  data: Employee[]
  isLoading?: boolean
  onDelete?: (employee: Employee) => void
  onToggleActive?: (employee: Employee) => void
}

const employmentTypeLabels: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACTOR: 'Contractor',
  INTERN: 'Intern',
}

export function EmployeeTable({ data, isLoading, onDelete, onToggleActive }: EmployeeTableProps) {
  const router = useRouter()

  const columns = [
    columnHelper.accessor('employeeCode', {
      header: 'Employee ID',
      cell: (info) => (
        <span className="font-mono text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
      id: 'fullName',
      header: 'Name',
      cell: (info) => (
        <span className="font-medium text-text-primary">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
    }),
    columnHelper.accessor('department', {
      header: 'Department',
    }),
    columnHelper.accessor('position', {
      header: 'Position',
    }),
    columnHelper.accessor('employmentType', {
      header: 'Type',
      cell: (info) => employmentTypeLabels[info.getValue()],
    }),
    columnHelper.accessor('salary', {
      header: 'Salary',
      cell: (info) => formatCurrency(info.getValue(), info.row.original.currency),
    }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => (
        <Badge variant={info.getValue() ? 'success' : 'default'}>
          {info.getValue() ? 'Active' : 'Inactive'}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const employee = info.row.original
        
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/payroll/${employee.id}`)}
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
                  onClick: () => router.push(`/payroll/${employee.id}`),
                },
                {
                  label: 'Edit Employee',
                  icon: <Edit className="h-4 w-4" />,
                  onClick: () => router.push(`/payroll/${employee.id}/edit`),
                },
                {
                  label: employee.isActive ? 'Deactivate' : 'Activate',
                  icon: employee.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />,
                  onClick: () => onToggleActive?.(employee),
                },
                {
                  divider: true,
                },
                {
                  label: 'Delete',
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: () => onDelete?.(employee),
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
          <p className="text-text-tertiary">No employees found</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => router.push('/payroll/new')}
          >
            Add Employee
          </Button>
        </div>
      }
    />
  )
}