import { describe, it, expect } from 'vitest'
import { getAllowedProofSubmissions } from '@/lib/milestone-utils'

describe('getAllowedProofSubmissions', () => {
  it('limits submissions to initial + revision requests up to limit', () => {
    expect(getAllowedProofSubmissions(0, 1)).toBe(1)
    expect(getAllowedProofSubmissions(1, 1)).toBe(2)
    expect(getAllowedProofSubmissions(2, 1)).toBe(2)
  })
})
