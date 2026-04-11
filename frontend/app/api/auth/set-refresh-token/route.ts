/**
 * app/api/auth/set-refresh-token/route.ts
 *
 * FIXES APPLIED:
 * 1. No logic bugs — kept as-is.
 * 2. Confirmed cookie name is `fincore_refresh` (matches middleware + refresh
 *    route). No change needed here — it was already correct.
 * 3. Added `export const dynamic = 'force-dynamic'` so Next.js never
 *    statically caches this POST handler.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json({ message: 'Refresh token required' }, { status: 400 })
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set('fincore_refresh', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60, // 7 days
      path:     '/',
    })

    return response
  } catch (err) {
    console.error('set-refresh-token error:', err)
    return NextResponse.json({ message: 'Failed to set refresh token' }, { status: 500 })
  }
}
