/**
 * app/api/auth/refresh/route.ts
 *
 * Next.js BFF proxy for token rotation.
 *
 * Flow:
 *   1. Read `fincore_refresh` HttpOnly cookie (set at login via /api/auth/set-refresh-token)
 *   2. POST to backend /auth/refresh with the token in the request BODY
 *      (backend accepts cookie OR body — body is used here because the backend
 *       is on a different domain in development)
 *   3. Backend returns { data: { accessToken, refreshToken } }
 *   4. Rotate `fincore_refresh` cookie and return { accessToken, refreshToken }
 *
 * The lib/api.ts 401 interceptor calls this route.
 * useInitSession calls the backend directly via apiClient (uses backend cookie).
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000/v1'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('fincore_refresh')?.value

    if (!refreshToken) {
      return NextResponse.json({ message: 'No refresh token found' }, { status: 401 })
    }

    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send token in body — backend accepts from body when not in cookie
      body:    JSON.stringify({ refreshToken }),
    })

    if (response.status === 401) {
      const res = NextResponse.json({ message: 'Refresh token expired or invalid' }, { status: 401 })
      res.cookies.delete({ name: 'fincore_refresh', path: '/' })
      return res
    }

    if (!response.ok) {
      const text = await response.text()
      console.error('Backend refresh error:', response.status, text)
      return NextResponse.json({ message: 'Refresh failed' }, { status: response.status })
    }

    const raw = await response.json()

    // Backend wraps responses in { data: T, timestamp }
    const payload        = raw?.data ?? raw
    const accessToken    = payload?.accessToken
    const newRefreshToken = payload?.refreshToken

    if (!accessToken) {
      console.error('No accessToken in refresh response:', JSON.stringify(raw))
      return NextResponse.json({ message: 'Invalid response from auth server' }, { status: 500 })
    }

    const res = NextResponse.json({
      accessToken,
      ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
    })

    // Rotate fincore_refresh cookie if backend issued a new refresh token
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
