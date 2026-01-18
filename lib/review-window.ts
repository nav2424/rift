import { calculateAutoReleaseDeadline } from './rift-state'
import {
  calculateMilestoneAutoReleaseAt,
  getMilestoneReviewWindowDays,
  getNextUnreleasedMilestoneIndex,
  normalizeMilestones,
} from './milestone-utils'

type ReviewWindowParams = {
  autoReleaseAt?: Date | string | null
  itemType: string
  allowsPartialRelease?: boolean | null
  milestones?: unknown
  proofSubmittedAt?: Date | null
  fundedAt?: Date | null
  milestoneReleases?: Array<{ milestoneIndex: number; status?: string }>
}

export function getReviewWindowDeadline(params: ReviewWindowParams): Date | null {
  const {
    autoReleaseAt,
    itemType,
    allowsPartialRelease,
    milestones,
    proofSubmittedAt,
    fundedAt,
    milestoneReleases = [],
  } = params

  if (autoReleaseAt) {
    return new Date(autoReleaseAt)
  }

  if (
    itemType === 'SERVICES' &&
    allowsPartialRelease &&
    milestones &&
    proofSubmittedAt
  ) {
    const normalized = normalizeMilestones(milestones)
    const nextIndex = getNextUnreleasedMilestoneIndex(normalized, milestoneReleases)
    if (nextIndex !== null) {
      const reviewWindowDays = getMilestoneReviewWindowDays(normalized[nextIndex])
      return calculateMilestoneAutoReleaseAt(proofSubmittedAt, reviewWindowDays)
    }
  }

  return calculateAutoReleaseDeadline(itemType, proofSubmittedAt || null, fundedAt || null)
}
