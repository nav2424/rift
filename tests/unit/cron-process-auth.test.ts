import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auto-release', () => ({
  processAutoReleases: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/ugc/auto-approve', () => ({
  autoApproveMilestonesJob: vi.fn().mockResolvedValue({
    processed: 0,
    approved: [],
    skipped: [],
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payout: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: null,
}))

let POST: typeof import('@/app/api/cron/process/route').POST

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET

beforeAll(async () => {
  const routeModule = await import('@/app/api/cron/process/route')
  POST = routeModule.POST
})

describe('cron process route auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV
    }

    if (ORIGINAL_CRON_SECRET === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = ORIGINAL_CRON_SECRET
    }
  })

  it('fails closed when CRON_SECRET is missing outside tests', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.CRON_SECRET

    const request = new NextRequest('http://localhost/api/cron/process', {
      method: 'POST',
    })
    const response = await POST(request)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Cron endpoint is not configured',
    })
  })

  it('returns 401 when CRON_SECRET is set but header is missing', async () => {
    process.env.NODE_ENV = 'production'
    process.env.CRON_SECRET = 'expected-cron-secret'

    const request = new NextRequest('http://localhost/api/cron/process', {
      method: 'POST',
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unauthorized',
    })
  })

  it('accepts valid authorization header when CRON_SECRET is configured', async () => {
    process.env.NODE_ENV = 'production'
    process.env.CRON_SECRET = 'expected-cron-secret'

    const request = new NextRequest('http://localhost/api/cron/process', {
      method: 'POST',
      headers: {
        authorization: 'Bearer expected-cron-secret',
      },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true })
  })
})
