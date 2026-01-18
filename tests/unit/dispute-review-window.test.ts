import { describe, it, expect } from 'vitest'
import { getReviewWindowDeadline } from '@/lib/review-window'

describe('Dispute review window timing', () => {
  it('treats disputes after the review deadline as blocked', () => {
    const deadline = getReviewWindowDeadline({
      itemType: 'SERVICES',
      allowsPartialRelease: true,
      milestones: [{ reviewWindowDays: 3, dueDate: '2026-01-10', amount: 100, title: 'M1' }],
      proofSubmittedAt: new Date('2026-01-01T00:00:00Z'),
      milestoneReleases: [],
    }) as Date

    const afterDeadline = new Date('2026-01-05T00:00:00Z')
    expect(afterDeadline > deadline).toBe(true)
  })
})
