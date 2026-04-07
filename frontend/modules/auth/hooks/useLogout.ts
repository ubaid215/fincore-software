'use client'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'

export function useLogout() {
  const router = useRouter()
  const { clearAuth } = useAuthStore()

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearAuth()
      router.push('/login')
    },
    onError: () => {
      // Still clear local state even if API call fails
      clearAuth()
      router.push('/login')
    },
  })
}