import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { generateNextCampaignNumber } from '@/lib/campaign-number'
import { buildSanitizedBrief, seedCampaignMilestones, completeCampaignMilestone } from '@/lib/campaigns'
import { randomUUID } from 'crypto'
import { UsageRightsType } from '@prisma/client'

async function isBrandUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, BrandProfile: { select: { id: true } } },
  })
  return user?.platformRole === 'BRAND' || !!user?.BrandProfile
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isAdmin = auth.userRole === 'ADMIN'
    const brandOnly = request.nextUrl.searchParams.get('brand') === 'true'

    const campaigns = await prisma.campaign.findMany({
      where: isAdmin && !brandOnly ? {} : { brandId: auth.userId },
      include: {
        brand: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            creator: { select: { id: true, name: true, email: true } },
          },
        },
        milestones: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ campaigns })
  } catch (error: unknown) {
    console.error('List campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const brandOk = auth.userRole === 'ADMIN' || (await isBrandUser(auth.userId))
    if (!brandOk) {
      return NextResponse.json({ error: 'Only brands can create campaigns' }, { status: 403 })
    }

    const body = await request.json()
    const {
      productName,
      talkingPoints,
      videoFormat,
      videoCount,
      usageRights,
      deadline,
      budget,
      currency = 'CAD',
      creatorRatePerVideo,
    } = body

    if (!productName || !talkingPoints || !videoFormat || !videoCount || !deadline || !budget) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedDeadline = new Date(deadline)
    if (Number.isNaN(parsedDeadline.getTime())) {
      return NextResponse.json({ error: 'Invalid deadline' }, { status: 400 })
    }

    const rights = (usageRights as UsageRightsType) || 'ORGANIC_ONLY'
    const campaignId = randomUUID()
    const campaignNumber = await generateNextCampaignNumber()
    const sanitizedBrief = buildSanitizedBrief({
      productName,
      talkingPoints,
      videoFormat,
      videoCount: Number(videoCount),
      usageRights: rights,
      deadline: parsedDeadline,
    })

    const campaign = await prisma.campaign.create({
      data: {
        id: campaignId,
        campaignNumber,
        brandId: auth.userId,
        productName,
        talkingPoints,
        videoFormat,
        videoCount: Number(videoCount),
        usageRights: rights,
        deadline: parsedDeadline,
        sanitizedBrief,
        budget: Number(budget),
        currency,
        creatorRatePerVideo: creatorRatePerVideo ? Number(creatorRatePerVideo) : null,
        status: 'BRIEF_SUBMITTED',
        updatedAt: new Date(),
      },
    })

    await seedCampaignMilestones(campaignId, prisma)
    await completeCampaignMilestone(campaignId, 'brief_submitted', prisma)

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error: unknown) {
    console.error('Create campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
