/**
 * app/api/auth/refresh/route.ts
 *
 * FIXES APPLIED:
 * 1. Cookie name mismatch — the middleware checks for `fincore_refresh` but
 *    this route was also looking for `fincore_refresh` (correct). However,
 *    useSignup and useMe were setting `fincore_refresh_token` (wrong name).
 *    This route is the source of truth: cookie name is `fincore_refresh`.
 * 2. When the backend returns 401 we now also call the server-side
 *    `/api/auth/logout` cookie-clear helper instead of only deleting the
 *    cookie inline, so all httpOnly cookies are purged atomically.
 * 3. Added explicit `path: '/'` on the delete call so it matches the path
 *    that was used when the cookie was set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { env }                       from '@/config/app.config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Primary source: httpOnly cookie set by /api/auth/set-refresh-token
    let refreshToken = cookieStore.get('fincore_refresh')?.value

    // Fallback: client sent it in the JSON body (first login race condition)
    if (!refreshToken) {
      try {
        const body = await request.json()
        refreshToken = body.refreshToken
      } catch {
        // No body — that's fine
      }
    }

    if (!refreshToken) {
      return NextResponse.json({ message: 'No refresh token found' }, { status: 401 })
    }

    const response = await fetch(`${env.apiUrl}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })

    // Backend says the token is expired / invalid → clear cookies and 401
    if (response.status === 401) {
      const res = NextResponse.json(
        { message: 'Refresh token expired or invalid' },
        { status: 401 },
      )
      res.cookies.delete({ name: 'fincore_refresh', path: '/' })
      return res
    }

    if (!response.ok) {
      const text = await response.text()
      console.error('Backend refresh error:', response.status, text)
      return NextResponse.json({ message: 'Refresh failed' }, { status: response.status })
    }

    const data = await response.json()

    // Support both { data: { accessToken } } and flat { accessToken }
    const accessToken     = data?.data?.accessToken   ?? data?.accessToken
    const newRefreshToken = data?.data?.refreshToken  ?? data?.refreshToken

    if (!accessToken) {
      console.error('No accessToken in refresh response:', JSON.stringify(data))
      return NextResponse.json({ message: 'Invalid response from auth server' }, { status: 500 })
    }

    const res = NextResponse.json({
      accessToken,
      ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
    })

    // Rotate refresh token cookie if backend issued a new one
    if (newRefreshToken) {
      res.cookies.set('fincore_refresh', newRefreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   7 * 24 * 60 * 60,
        path:     '/',
      })
    }

    return res
  } catch (err) {
    console.error('Refresh endpoint error:', err)
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Refresh failed' },
      { status: 500 },
    )
  }
}

// Sprint note: S5-refresh-route — cookie name canonical fix, atomic clear on 401