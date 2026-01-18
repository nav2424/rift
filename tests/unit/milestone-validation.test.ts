import { describe, it, expect } from 'vitest'
import { validateMilestoneDates } from '@/lib/milestone-validation'

describe('validateMilestoneDates', () => {
  it('rejects milestones that are not sequential', () => {
    const milestones = [
      { dueDate: '2026-01-10' },
      { dueDate: '2026-01-10' },
    ]
    const error = validateMilestoneDates(milestones, '2026-01-20')
    expect(error).toContain('after the previous milestone date')
  })

  it('rejects milestones after the service delivery date', () => {
    const milestones = [
      { dueDate: '2026-01-10' },
      { dueDate: '2026-01-22' },
    ]
    const error = validateMilestoneDates(milestones, '2026-01-20')
    expect(error).toContain('Final milestone date')
  })

  it('accepts valid milestone dates', () => {
    const milestones = [
      { dueDate: '2026-01-10' },
      { dueDate: '2026-01-15' },
    ]
    const error = validateMilestoneDates(milestones, '2026-01-20')
    expect(error).toBeNull()
  })
})
