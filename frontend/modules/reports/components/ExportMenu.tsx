'use client'

import { useState } from 'react'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button, Dropdown } from '@/shared/ui'
import { reportsApi } from '../api/reports.api'
import { toast } from '@/shared/hooks/useToast'

interface ExportMenuProps {
  orgId: string
  reportType: string
  filters: any
}

export function ExportMenu({ orgId, reportType, filters }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setIsExporting(true)
    try {
      const response = await reportsApi.exportReport(orgId, reportType, format, filters)
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${reportType}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export report')
    } finally {
      setIsExporting(false)
    }
  }

  const exportItems = [
    {
      label: 'Export as PDF',
      icon: <FileText className="h-4 w-4" />,
      onClick: () => handleExport('pdf'),
      disabled: isExporting,
    },
    {
      label: 'Export as Excel',
      icon: <FileSpreadsheet className="h-4 w-4" />,
      onClick: () => handleExport('xlsx'),
      disabled: isExporting,
    },
  ]

  return (
    <Dropdown
      trigger={
        <Button variant="secondary" size="sm" disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </>
          )}
        </Button>
      }
      items={exportItems}
    />
  )
}