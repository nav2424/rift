import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { completeCampaignMilestone } from '@/lib/campaigns'
import { sendCampaignAssignmentEmail } from '@/lib/campaign-email'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: campaignId } = await params
    const body = await request.json()
    let { creatorId, payoutAmount } = body
    const creatorEmail = body.creatorEmail as string | undefined

    if (!creatorId && creatorEmail) {
      const byEmail = await prisma.user.findUnique({ where: { email: creatorEmail }, select: { id: true } })
      creatorId = byEmail?.id
    }

    if (!creatorId) {
      return NextResponse.json({ error: 'creatorId or creatorEmail is required' }, { status: 400 })
    }

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, platformRole: true, CreatorProfile: { select: { id: true } } },
    })
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    const rate = payoutAmount ?? campaign.creatorRatePerVideo ?? 0

    const assignment = await prisma.creatorAssignment.upsert({
      where: { campaignId_creatorId: { campaignId, creatorId } },
      create: {
        id: randomUUID(),
        campaignId,
        creatorId,
        payoutAmount: rate,
        status: 'ASSIGNED',
        updatedAt: new Date(),
      },
      update: {
        payoutAmount: rate,
        updatedAt: new Date(),
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'CREATORS_ASSIGNED',
        updatedAt: new Date(),
      },
    })

    await completeCampaignMilestone(campaignId, 'creators_assigned', prisma)

    if (assignment.creator.email) {
      sendCampaignAssignmentEmail(
        assignment.creator.email,
        campaign.campaignNumber,
        campaign.productName,
        campaign.deadline,
        rate,
        campaign.currency
      ).catch((err) => console.error('Assignment email failed:', err))
    }

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error: unknown) {
    console.error('Assign creator error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
