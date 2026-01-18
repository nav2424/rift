export type RiftMilestone = {
  title: string
  description?: string
  deliverables?: string
  amount: number
  dueDate: string
  reviewWindowDays?: number
  revisionLimit?: number
}

export function normalizeMilestones(raw: unknown): RiftMilestone[] {
  if (!Array.isArray(raw)) return []
  return raw.map((milestone: any) => ({
    title: milestone?.title || '',
    description: milestone?.description || '',
    deliverables: milestone?.deliverables || '',
    amount: typeof milestone?.amount === 'number' ? milestone.amount : Number(milestone?.amount || 0),
    dueDate: milestone?.dueDate || '',
    reviewWindowDays: typeof milestone?.reviewWindowDays === 'number' ? milestone.reviewWindowDays : undefined,
    revisionLimit: typeof milestone?.revisionLimit === 'number' ? milestone.revisionLimit : undefined,
  }))
}

export function getNextUnreleasedMilestoneIndex(
  milestones: RiftMilestone[],
  releases: Array<{ milestoneIndex: number; status?: string }>
): number | null {
  const releasedIndices = new Set(
    releases.filter((r) => r.status === 'RELEASED').map((r) => r.milestoneIndex)
  )
  for (let i = 0; i < milestones.length; i += 1) {
    if (!releasedIndices.has(i)) return i
  }
  return null
}

export function getLatestReleasedAt(
  releases: Array<{ releasedAt?: Date | null; status?: string }>
): Date | null {
  const releasedDates = releases
    .filter((r) => r.status === 'RELEASED' && r.releasedAt)
    .map((r) => r.releasedAt as Date)
  if (releasedDates.length === 0) return null
  return new Date(Math.max(...releasedDates.map((d) => d.getTime())))
}

export function getMilestoneReviewWindowDays(milestone: RiftMilestone): number {
  const days = milestone.reviewWindowDays
  return typeof days === 'number' && days > 0 ? days : 3
}

export function getMilestoneRevisionLimit(milestone: RiftMilestone): number {
  return typeof milestone.revisionLimit === 'number' && milestone.revisionLimit >= 0
    ? milestone.revisionLimit
    : 1
}

export function calculateMilestoneAutoReleaseAt(
  proofSubmittedAt: Date,
  reviewWindowDays: number
): Date {
  return new Date(proofSubmittedAt.getTime() + reviewWindowDays * 24 * 60 * 60 * 1000)
}

export function getAllowedProofSubmissions(
  revisionRequests: number,
  revisionLimit: number
): number {
  const allowedRevisions = Math.min(Math.max(revisionRequests, 0), Math.max(revisionLimit, 0))
  return 1 + allowedRevisions
}
