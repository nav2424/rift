import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  const requestId = crypto.randomUUID().slice(0, 8)
  response.headers.set('X-Request-Id', requestId)

  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://api.openai.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ]
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))

  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      process.env.NEXTAUTH_URL || 'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean)

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  const isAdminRoute = pathname.startsWith('/admin')
  const isBrandRoute = pathname.startsWith('/brand')

  if (isAdminRoute || isBrandRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      const signIn = new URL('/auth/signin', request.url)
      signIn.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signIn)
    }

    if (isAdminRoute && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (isBrandRoute && token.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // Hide legacy creator portal
  if (pathname.startsWith('/creator')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const legacyRedirects: Record<string, string> = {
    '/brand/campaigns': '/brand/requests',
    '/brand/discover': '/brand/requests',
    '/admin/campaigns': '/admin/requests',
    '/wallet': '/dashboard',
    '/rifts': '/dashboard',
    '/activity': '/dashboard',
  }

  if (legacyRedirects[pathname]) {
    return NextResponse.redirect(new URL(legacyRedirects[pathname], request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
