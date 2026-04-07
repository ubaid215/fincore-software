'use client'

import { useRef, useState } from 'react'
import { Upload, X, File, Camera } from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { Button } from './Button'

export interface FileUploadProps {
  onUpload: (file: File) => Promise<string>
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
  accept?: string
  maxSize?: number
  label?: string
  className?: string
  capture?: boolean
}

export function FileUpload({
  onUpload,
  onSuccess,
  onError,
  accept = 'image/*,application/pdf',
  maxSize = 5,
  label = 'Upload file',
  className,
  capture = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size exceeds ${maxSize}MB`)
      return
    }

    setFileName(file.name)
    setError(null)
    setIsUploading(true)

    try {
      const url = await onUpload(file)
      onSuccess?.(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      onError?.(err instanceof Error ? err : new Error(message))
      setFileName(null)
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

  const handleClear = () => {
    setFileName(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('w-full', className)}>
      {!fileName && !isUploading ? (
        <div
          className={cn(
            'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 sm:p-6 transition-colors',
            isDragging ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-2',
            'active:bg-surface',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mb-2 h-6 w-6 sm:h-8 sm:w-8 text-text-tertiary" />
          <p className="text-xs sm:text-sm text-text-secondary text-center">{label}</p>
          <p className="mt-1 text-xs text-text-tertiary text-center">
            {accept.split(',').join(', ')} · Max {maxSize}MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            capture={capture}
            className="hidden"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <File className="h-4 w-4 sm:h-5 sm:w-5 text-text-tertiary shrink-0" />
              <span className="text-xs sm:text-sm text-text-primary truncate">{fileName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="shrink-0"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {isUploading && (
        <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-text-tertiary">
          <div className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Uploading...</span>
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-xs sm:text-sm text-danger">{error}</p>
      )}
    </div>
  )
}