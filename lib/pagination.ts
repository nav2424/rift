/**
 * Pagination utilities
 */

import { NextRequest } from 'next/server'

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page?: number
    limit?: number
    total?: number
    hasMore: boolean
    nextPage?: number
  }
}

export function parsePaginationParams(request: NextRequest): {
  page: number
  limit: number
  skip: number
} {
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total?: number
): PaginatedResponse<T> {
  const hasMore = total !== undefined ? (page * limit) < total : data.length === limit

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      hasMore,
      ...(hasMore && { nextPage: page + 1 }),
    },
  }
}
