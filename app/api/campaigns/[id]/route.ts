import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { buildSanitizedBrief, completeCampaignMilestone } from '@/lib/campaigns'
import { CampaignStatus } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            creator: { select: { id: true, name: true, email: true } },
          },
        },
        milestones: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const isBrand = campaign.brandId === auth.userId
    const isAdmin = auth.userRole === 'ADMIN'
    const isAssignedCreator = campaign.assignments.some((a) => a.creatorId === auth.userId)

    if (!isBrand && !isAdmin && !isAssignedCreator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = { ...campaign }
    if (isAssignedCreator && !isAdmin) {
      payload.talkingPoints = ''
      payload.brand = { id: 'agency', name: 'Rift Agency', email: 'agency@rift.app' }
    }

    return NextResponse.json({ campaign: payload })
  } catch (error: unknown) {
    console.error('Get campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const campaign = await prisma.campaign.findUnique({ where: { id } })

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const isAdmin = auth.userRole === 'ADMIN'
    const isBrand = campaign.brandId === auth.userId

    if (!isAdmin && !isBrand) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data: Record<string, unknown> = { updatedAt: new Date() }

    if (isAdmin) {
      if (body.status) data.status = body.status as CampaignStatus
      if (body.sanitizedBrief !== undefined) data.sanitizedBrief = body.sanitizedBrief
      if (body.creatorRatePerVideo !== undefined) data.creatorRatePerVideo = Number(body.creatorRatePerVideo)
    }

    if (isBrand && body.status === 'CANCELLED' && ['BRIEF_SUBMITTED', 'AWAITING_PAYMENT'].includes(campaign.status)) {
      data.status = 'CANCELLED'
    }

    if (isAdmin && body.regenerateSanitizedBrief) {
      data.sanitizedBrief = buildSanitizedBrief({
        productName: campaign.productName,
        talkingPoints: campaign.talkingPoints,
        videoFormat: campaign.videoFormat,
        videoCount: campaign.videoCount,
        usageRights: campaign.usageRights,
        deadline: campaign.deadline,
      })
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data,
      include: {
        assignments: {
          include: { creator: { select: { id: true, name: true, email: true } } },
        },
        milestones: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (body.status === 'DELIVERED' && isAdmin) {
      await completeCampaignMilestone(id, 'delivered', prisma)
      await prisma.campaign.update({
        where: { id },
        data: { deliveredAt: new Date() },
      })
    }

    return NextResponse.json({ campaign: updated })
  } catch (error: unknown) {
    console.error('Update campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
