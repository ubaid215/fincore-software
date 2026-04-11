// proxy.ts - bcz of next.js 16+
import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const PROTECTED_PREFIXES = ['/select', '/onboarding'];
const ORG_PATTERN = /^\/[0-9a-f-]{36}\//;

const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

// Public marketing routes (add freely)
const MARKETING_ROUTES = [
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/features',
];

const REFRESH_COOKIE = 'refresh_token';

// ─────────────────────────────────────────────────────────────
// PROXY FUNCTION
// ─────────────────────────────────────────────────────────────

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasRefreshCookie = req.cookies.has(REFRESH_COOKIE);

  // ── 1. Allow marketing routes always ────────────────────────
  const isMarketing =
    MARKETING_ROUTES.includes(pathname) ||
    pathname.startsWith('/blog'); // optional dynamic marketing

  if (isMarketing) {
    return NextResponse.next();
  }

  // ── 2. Protect app routes ───────────────────────────────────
  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ORG_PATTERN.test(pathname);

  if (isProtected && !hasRefreshCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 3. Redirect logged-in users away from auth pages ────────
  const isAuthPage = AUTH_ROUTES.some((r) =>
    pathname.startsWith(r)
  );

  if (isAuthPage && hasRefreshCookie) {
    return NextResponse.redirect(new URL('/select', req.url));
  }

  // ── 4. Default pass-through ─────────────────────────────────
  return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────
// MATCHER
// ─────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};