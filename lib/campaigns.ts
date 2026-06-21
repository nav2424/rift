import { CampaignStatus, AssignmentStatus } from '@prisma/client'

export const CAMPAIGN_MILESTONE_STAGES = [
  { stage: 'brief_submitted', label: 'Brief submitted', sortOrder: 1 },
  { stage: 'creators_assigned', label: 'Creators assigned', sortOrder: 2 },
  { stage: 'content_uploaded', label: 'Content uploaded', sortOrder: 3 },
  { stage: 'content_reviewed', label: 'Content reviewed', sortOrder: 4 },
  { stage: 'delivered', label: 'Delivered to brand', sortOrder: 5 },
] as const

export function buildSanitizedBrief(input: {
  productName: string
  talkingPoints: string
  videoFormat: string
  videoCount: number
  usageRights: string
  deadline: Date
}): string {
  return [
    'Campaign brief (brand details withheld)',
    '',
    `Product category: ${input.productName}`,
    `Videos needed: ${input.videoCount}`,
    `Format: ${input.videoFormat}`,
    `Usage rights: ${input.usageRights.replace(/_/g, ' ')}`,
    `Deadline: ${input.deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    '',
    'Talking points:',
    input.talkingPoints,
  ].join('\n')
}

export function campaignStatusLabel(status: CampaignStatus): string {
  return status.replace(/_/g, ' ')
}

export function assignmentStatusLabel(status: AssignmentStatus): string {
  return status.replace(/_/g, ' ')
}

export function campaignStatusColor(status: CampaignStatus): string {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'CONTENT_REVIEWED':
    case 'CONTENT_UPLOADED':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'CREATORS_ASSIGNED':
    case 'IN_PRODUCTION':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'UNDER_REVIEW':
    case 'AWAITING_PAYMENT':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'CANCELLED':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export async function seedCampaignMilestones(campaignId: string, prisma: { campaignMilestone: { createMany: (args: { data: Array<{ id: string; campaignId: string; stage: string; label: string; sortOrder: number }> }) => Promise<unknown> } }) {
  const { randomUUID } = await import('crypto')
  await prisma.campaignMilestone.createMany({
    data: CAMPAIGN_MILESTONE_STAGES.map((m) => ({
      id: randomUUID(),
      campaignId,
      stage: m.stage,
      label: m.label,
      sortOrder: m.sortOrder,
    })),
  })
}

export async function completeCampaignMilestone(
  campaignId: string,
  stage: string,
  prisma: { campaignMilestone: { updateMany: (args: { where: { campaignId: string; stage: string }; data: { completedAt: Date } }) => Promise<unknown> } }
) {
  await prisma.campaignMilestone.updateMany({
    where: { campaignId, stage },
    data: { completedAt: new Date() },
  })
}
