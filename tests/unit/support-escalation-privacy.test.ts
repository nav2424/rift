import { beforeEach, describe, expect, it, vi } from 'vitest'

const openAiCreateMock = vi.fn()

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: openAiCreateMock,
      },
    },
  })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    riftTransaction: {
      findMany: vi.fn(),
    },
    supportTicket: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('support escalation privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not include direct user identifiers in AI prompt context', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { generateSupportTicket } = await import('@/lib/ai/support-escalation')

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'private.user@example.com',
      name: 'Private User',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    } as any)
    vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([
      { id: 'r1', itemTitle: 'Design', status: 'FUNDED', createdAt: new Date('2026-01-01T00:00:00Z') },
    ] as any)
    vi.mocked(prisma.supportTicket.findFirst).mockResolvedValue(null as any)
    vi.mocked(prisma.supportTicket.create).mockResolvedValue({ id: 'ticket-1' } as any)
    openAiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Help with payment',
              description: 'Customer asked for help',
              priority: 'medium',
            }),
          },
        },
      ],
    })

    const result = await generateSupportTicket('user-1', 'I need help with a payment issue', 'payment')

    expect(result).toBe('ticket-1')
    expect(openAiCreateMock).toHaveBeenCalledTimes(1)

    const prompt = openAiCreateMock.mock.calls[0]?.[0]?.messages?.[1]?.content as string
    expect(prompt).toContain('accountAgeDays')
    expect(prompt).not.toContain('private.user@example.com')
    expect(prompt).not.toContain('Private User')

    const createPayload = vi.mocked(prisma.supportTicket.create).mock.calls[0]?.[0]
    expect(createPayload?.data?.metadata?.user?.email).toBeUndefined()
    expect(createPayload?.data?.metadata?.user?.name).toBeUndefined()
  })
})
