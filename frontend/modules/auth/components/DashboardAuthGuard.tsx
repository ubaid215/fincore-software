/**
 * modules/auth/components/DashboardAuthGuard.tsx
 *
 * FIXES APPLIED:
 * 1. useMe() was called unconditionally — even on pages that ended up inside
 *    the (dashboard) route group while having no session (e.g. /home, /select
 *    visited without a cookie). The /auth/me request fires → 401 → refresh
 *    fires → 401 → guard redirects to /login. Pages that should be public
 *    were being blocked.
 *
 *    Fixed: read the `fincore_refresh` cookie client-side before deciding
 *    whether to call useMe. If there is no cookie the user is unauthenticated —
 *    render children immediately (public pages work) and let the proxy handle
 *    actual protected-route enforcement server-side.
 *
 * 2. `initialized` from the store starts as `false` on every cold render,
 *    so unauthenticated users on public pages saw an infinite spinner.
 *    Fixed: skip the spinner entirely when there is no session cookie.
 *
 * 3. The `isError` redirect fired even during the initial loading phase when
 *    `isError` was briefly `false` then flipped to `true` from a stale query.
 *    Fixed: only redirect after the query has settled (not loading).
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useMe }        from '../hooks/useMe'
import { useAuthStore } from '../store/auth.store'

interface Props {
  children: React.ReactNode
}

/** Read a cookie value client-side (returns undefined on SSR) */
function getClientCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

// ─── Inner component — only mounted when a session cookie exists ──────────

function AuthenticatedGuard({ children }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const { isLoading, isError } = useMe()
  const { initialized } = useAuthStore()

  useEffect(() => {
    // Only redirect after the query has fully settled and confirmed failure
    if (!isLoading && isError) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, isError, pathname, router])

  // Show spinner only while the session is being validated
  if (!initialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-text-tertiary">Loading…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// ─── Outer guard — decides whether session validation is needed ───────────

export function DashboardAuthGuard({ children }: Props) {
  // Use state so we only read the cookie after hydration (avoids SSR mismatch)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const cookie = getClientCookie('fincore_refresh')
    setHasSession(!!cookie)
  }, [])

  // Still hydrating — render nothing briefly to avoid flicker
  if (hasSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  // No session cookie → render children directly (public pages, unauthenticated)
  // The proxy already enforces that truly protected routes redirect to /login
  // before reaching here, so this path only occurs for public pages.
  if (!hasSession) {
    return <>{children}</>
  }

  // Session cookie present → validate it and keep the store hydrated
  return <AuthenticatedGuard>{children}</AuthenticatedGuard>
}

// Sprint note: S5-auth-guard — fixed unconditional useMe, infinite spinner on public pages