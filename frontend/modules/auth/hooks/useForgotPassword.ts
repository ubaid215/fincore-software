/**
 * modules/auth/hooks/useForgotPassword.ts
 *
 * FIXES APPLIED:
 * 1. Added 'use client' directive — useMutation from @tanstack/react-query
 *    must run on the client. Without this directive, Next.js App Router
 *    attempts to render the hook as a Server Component and throws at runtime.
 */

'use client'

import { useMutation } from '@tanstack/react-query'
import { authApi }     from '../api/auth.api'

export function useForgotPassword() {
  return useMutation({
    mutationFn: authApi.forgotPassword,
  })
}
