'use client'

import { useRef, useState } from 'react'
import { Upload, X, File } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Button } from './Button'

export interface FileUploadProps {
  onUpload: (file: File) => Promise<string>
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
  accept?: string
  maxSize?: number // in MB
  label?: string
  className?: string
}

export function FileUpload({
  onUpload,
  onSuccess,
  onError,
  accept = 'image/*,application/pdf',
  maxSize = 5,
  label = 'Upload file',
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size exceeds ${maxSize}MB`)
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const url = await onUpload(file)
      onSuccess?.(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      onError?.(err instanceof Error ? err : new Error(message))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-2',
          isUploading && 'pointer-events-none opacity-50',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mb-2 h-8 w-8 text-text-tertiary" />
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="mt-1 text-xs text-text-tertiary">
          {accept.split(',').join(', ')} · Max {maxSize}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {isUploading && (
        <div className="mt-2 flex items-center gap-2 text-sm text-text-tertiary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Uploading...
        </div>
      )}
    </div>
  )
}