import { prisma } from './prisma'

export async function generateNextCampaignNumber(): Promise<number> {
  const last = await prisma.campaign.findFirst({
    orderBy: { campaignNumber: 'desc' },
    select: { campaignNumber: true },
  })
  return last ? last.campaignNumber + 1 : 1000
}
