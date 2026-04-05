import { type NextRequest, NextResponse } from 'next/server'

// Routes accessible without authentication
const PUBLIC_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/invite',
])

// Routes that bypass all auth checks
const BYPASS_ROUTES = [
  '/api/auth/',
  '/_next/',
  '/favicon',
  '/robots',
  '/sitemap',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass static/internal routes immediately
  if (BYPASS_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Public marketing pages
  if (pathname === '/') {
    return NextResponse.next()
  }

  const hasRefreshToken = request.cookies.has('fincore_refresh')

  // Unauthenticated user hitting a protected route → login
  if (!hasRefreshToken && !PUBLIC_ROUTES.has(pathname)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user hitting auth pages → redirect to dashboard
  if (hasRefreshToken && PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.redirect(new URL('/dashboard/select', request.url))
  }

  // Tenant-scoped route guard — /dashboard/[orgId]/*
  const orgMatch = pathname.match(/^\/dashboard\/([a-zA-Z0-9_-]+)/)
  if (orgMatch && orgMatch[1] !== 'select') {
    const orgId = orgMatch[1]
    const allowedOrgs = request.cookies.get('fincore_orgs')?.value?.split(',') ?? []

    if (allowedOrgs.length > 0 && !allowedOrgs.includes(orgId)) {
      // Org not in user's list → back to org selector
      return NextResponse.redirect(new URL('/dashboard/select', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - Public file extensions
     */
    '/((?!_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|webp|woff2|woff|ttf)).*)',
  ],
}