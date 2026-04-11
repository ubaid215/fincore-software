/**
 * modules/auth/hooks/useLogout.ts
 *
 * FIXES APPLIED:
 * 1. CRITICAL: The httpOnly `fincore_refresh` cookie CANNOT be deleted from
 *    JavaScript (document.cookie). The original code tried to clear it with
 *    `document.cookie = 'fincore_refresh=; max-age=0'` — this is silently
 *    ignored by the browser for httpOnly cookies. After logout the middleware
 *    still saw the cookie and redirected the user BACK to /select instead of
 *    showing the login page. Fixed by calling POST /api/auth/logout which
 *    deletes the cookie server-side via NextResponse.cookies.delete().
 * 2. Removed the unused `expired` variable (was declared but never used).
 * 3. Indentation fix on the document.cookie lines (cosmetic).
 */

'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter }   from 'next/navigation'
import { authApi }     from '../api/auth.api'
import { useAuthStore } from '../store/auth.store'

/** Clears client-readable cookies set during login. */
function clearClientCookies() {
  document.cookie = 'fincore_authenticated=; path=/; max-age=0; SameSite=Lax'
  document.cookie = 'fincore_orgs=; path=/; max-age=0; SameSite=Lax'
  // NOTE: fincore_refresh is httpOnly — must be cleared via the server route below
}

async function clearHttpOnlyCookies() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch (err) {
    // Non-fatal — server-side cookie will expire naturally
    console.warn('Could not clear httpOnly cookie via server route:', err)
  }
}

export function useLogout() {
  const router    = useRouter()
  const { clearAuth } = useAuthStore()

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      clearClientCookies()
      await clearHttpOnlyCookies()   // FIX: delete httpOnly fincore_refresh
      clearAuth()
      router.push('/login')
    },
    onError: async () => {
      // Still clear everything even if the backend call fails
      clearClientCookies()
      await clearHttpOnlyCookies()
      clearAuth()
      router.push('/login')
    },
  })
}

// Sprint note: S5-useLogout — fixed httpOnly cookie not being cleared on logout