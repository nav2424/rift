import { NextRequest, NextResponse } from 'next/server'
import { apiRateLimit, strictApiRateLimit, authRateLimit, type RateLimitOptions } from './rate-limit'

/**
 * Apply rate limiting to an API route handler
 */
export function withRateLimit<T = any>(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse<T>> | NextResponse<T>,
  options?: {
    rateLimit?: 'default' | 'strict' | 'auth' | RateLimitOptions
    skipForDevelopment?: boolean
  }
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse<T>> => {
    // Skip rate limiting in development if requested
    if (options?.skipForDevelopment && process.env.NODE_ENV === 'development') {
      return handler(request, ...args)
    }

    // Choose rate limiter
    let result
    if (options?.rateLimit === 'strict') {
      result = strictApiRateLimit(request)
    } else if (options?.rateLimit === 'auth') {
      result = authRateLimit(request)
    } else {
      result = apiRateLimit(request)
    }

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      ) as NextResponse<T>
    }

    // Call the handler
    const response = await handler(request, ...args)

    // Add rate limit headers to successful responses
    const headers = new Headers(response.headers)
    headers.set('X-RateLimit-Remaining', result.remaining.toString())
    headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString())

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }) as NextResponse<T>
  }
}

