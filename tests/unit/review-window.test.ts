import { describe, it, expect } from 'vitest'
import { getReviewWindowDeadline } from '@/lib/review-window'

describe('getReviewWindowDeadline', () => {
  it('uses milestone review window when autoReleaseAt is missing', () => {
    const deadline = getReviewWindowDeadline({
      itemType: 'SERVICES',
      allowsPartialRelease: true,
      milestones: [{ reviewWindowDays: 5, dueDate: '2026-01-10', amount: 100, title: 'M1' }],
      proofSubmittedAt: new Date('2026-01-01T00:00:00Z'),
      milestoneReleases: [],
    })

    expect(deadline?.toISOString()).toBe('2026-01-06T00:00:00.000Z')
  })

  it('uses autoReleaseAt when present', () => {
    const deadline = getReviewWindowDeadline({
      itemType: 'SERVICES',
      allowsPartialRelease: true,
      milestones: [],
      proofSubmittedAt: new Date('2026-01-01T00:00:00Z'),
      autoReleaseAt: new Date('2026-01-04T00:00:00Z'),
      milestoneReleases: [],
    })

    expect(deadline?.toISOString()).toBe('2026-01-04T00:00:00.000Z')
  })
})
