import { useState, useCallback } from 'react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: string
  title?: string
  description: string
  variant: ToastVariant
}

let toastId = 0
const listeners: ((toasts: ToastMessage[]) => void)[] = []
let toasts: ToastMessage[] = []

function notifyListeners() {
  listeners.forEach(listener => listener(toasts))
}

export function toast(message: { title?: string; description: string; variant?: ToastVariant }) {
  const id = String(toastId++)
  const newToast = {
    id,
    title: message.title,
    description: message.description,
    variant: message.variant || 'info',
  }
  toasts = [...toasts, newToast]
  notifyListeners()

  // Auto remove after 5 seconds
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    notifyListeners()
  }, 5000)

  return id
}

export function useToast() {
  const [localToasts, setLocalToasts] = useState<ToastMessage[]>(toasts)

  useState(() => {
    const listener = (newToasts: ToastMessage[]) => {
      setLocalToasts(newToasts)
    }
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index > -1) listeners.splice(index, 1)
    }
  })

  return { toasts: localToasts, toast }
}