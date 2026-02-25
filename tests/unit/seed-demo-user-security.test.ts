import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rift-user-id', () => ({
  generateNextRiftUserId: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
  },
}))

let POST: typeof import('@/app/api/seed-demo-user/route').POST
let prisma: typeof import('@/lib/prisma').prisma
let generateNextRiftUserId: typeof import('@/lib/rift-user-id').generateNextRiftUserId
let bcrypt: typeof import('bcryptjs').default

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_SEED_DEMO_SECRET = process.env.SEED_DEMO_SECRET

beforeAll(async () => {
  const routeModule = await import('@/app/api/seed-demo-user/route')
  POST = routeModule.POST
  const prismaModule = await import('@/lib/prisma')
  prisma = prismaModule.prisma
  const riftIdModule = await import('@/lib/rift-user-id')
  generateNextRiftUserId = riftIdModule.generateNextRiftUserId
  const bcryptModule = await import('bcryptjs')
  bcrypt = bcryptModule.default
})

describe('seed-demo-user route security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV
    }

    if (ORIGINAL_SEED_DEMO_SECRET === undefined) {
      delete process.env.SEED_DEMO_SECRET
    } else {
      process.env.SEED_DEMO_SECRET = ORIGINAL_SEED_DEMO_SECRET
    }
  })

  it('returns 503 when SEED_DEMO_SECRET is not configured outside tests', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.SEED_DEMO_SECRET

    const request = new Request('http://localhost/api/seed-demo-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'SEED_DEMO_SECRET is not configured',
    })
  })

  it('returns 403 when x-seed-secret does not match configured secret', async () => {
    process.env.NODE_ENV = 'development'
    process.env.SEED_DEMO_SECRET = 'expected-secret'

    const request = new Request('http://localhost/api/seed-demo-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-seed-secret': 'wrong-secret',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unauthorized',
    })
  })

  it('does not return plaintext password in successful responses', async () => {
    process.env.NODE_ENV = 'development'
    process.env.SEED_DEMO_SECRET = 'expected-secret'

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any)
    vi.mocked(generateNextRiftUserId).mockResolvedValue('RIFT-USER-1')
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1' } as any)

    const request = new Request('http://localhost/api/seed-demo-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-seed-secret': 'expected-secret',
      },
      body: JSON.stringify({
        email: 'demo@example.com',
        password: 'super-secret-password',
        name: 'Demo User',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload).toMatchObject({
      message: 'Demo user created successfully',
      email: 'demo@example.com',
      userId: 'user-1',
    })
    expect(payload.password).toBeUndefined()
  })
})
