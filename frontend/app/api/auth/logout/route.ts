/**
 * app/api/auth/logout/route.ts 
 *
 * WHY THIS EXISTS:
 * The httpOnly `fincore_refresh` cookie cannot be deleted from JavaScript
 * (document.cookie). useLogout.ts was only clearing the client-readable
 * cookies, leaving the httpOnly token alive. On the next page load the
 * middleware would still see `fincore_refresh` and consider the user
 * authenticated, preventing the login redirect.
 *
 * useLogout now calls POST /api/auth/logout before redirecting, which
 * deletes the httpOnly cookie server-side.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Delete the httpOnly refresh token cookie
  response.cookies.delete({ name: 'fincore_refresh', path: '/' })

  return response
}

// Sprint note: S5-logout-route — new route to clear httpOnly cookie on logout