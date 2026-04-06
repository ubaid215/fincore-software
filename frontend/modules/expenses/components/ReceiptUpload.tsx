'use client'

import { useState } from 'react'
import { FileUpload } from '@/shared/ui'
import { expensesApi } from '../api/expenses.api'

interface ReceiptUploadProps {
  orgId: string
  expenseId: string
  onUploadComplete?: (url: string) => void
}

export function ReceiptUpload({ orgId, expenseId, onUploadComplete }: ReceiptUploadProps) {
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (file: File): Promise<string> => {
    setIsUploading(true)
    try {
      const response = await expensesApi.uploadReceipt(orgId, expenseId, file)
      onUploadComplete?.(response.data.receiptUrl)
      return response.data.receiptUrl
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <FileUpload
      onUpload={handleUpload}
      accept="image/*,application/pdf"
      maxSize={5}
      label="Upload Receipt"
    />
  )
}