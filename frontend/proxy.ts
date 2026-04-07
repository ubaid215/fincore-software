import { NextRequest, NextResponse } from 'next/server'

// Routes accessible without authentication
const PUBLIC_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/invite',
  // Marketing pages - add these
  '/home',
  '/pricing',
  '/features',
  '/about',
  '/contact',
  '/blog',
])

// Routes that bypass all auth checks
const BYPASS_ROUTES = [
  '/api/auth/',
  '/_next/',
  '/favicon',
  '/robots',
  '/sitemap',
  '/sw.js',
  '/legal/',      // Add legal routes
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass static/internal routes immediately
  if (BYPASS_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Public marketing pages - allow all marketing routes
  if (PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/blog/') || pathname.startsWith('/legal/')) {
    return NextResponse.next()
  }

  // Root redirect
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

  // Tenant-scoped route guard
  const orgMatch = pathname.match(/^\/dashboard\/([a-zA-Z0-9_-]+)/)
  if (orgMatch && orgMatch[1] !== 'select') {
    const orgId = orgMatch[1]
    const allowedOrgsCookie = request.cookies.get('fincore_orgs')
    const allowedOrgs = allowedOrgsCookie?.value?.split(',') ?? []

    if (allowedOrgs.length > 0 && !allowedOrgs.includes(orgId)) {
      return NextResponse.redirect(new URL('/dashboard/select', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|svg|jpg|jpeg|webp|woff2|woff|ttf)).*)',
  ],
}