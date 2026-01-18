import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'

/**
 * Get milestones and their release status for a rift
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Try Prisma first, fallback to raw SQL if enum validation fails or columns don't exist
    let rift: any
    try {
      // Use explicit select to avoid schema mismatch with archive fields
      rift = await prisma.riftTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          itemType: true,
          allowsPartialRelease: true,
          milestones: true,
          autoReleaseAt: true,
          autoReleaseScheduled: true,
          status: true,
          MilestoneRelease: {
            orderBy: {
              milestoneIndex: 'asc',
            },
          },
        },
      })
    } catch (findError: any) {
      const isEnumError = findError?.message?.includes('enum') || 
                          findError?.message?.includes('not found in enum') ||
                          findError?.message?.includes("Value 'TICKETS'") ||
                          findError?.message?.includes("Value 'DIGITAL'")
      const isColumnError = findError?.code === 'P2022' || 
                            findError?.message?.includes('does not exist in the current database') ||
                            (findError?.message?.includes('column') && findError?.message?.includes('does not exist'))
      
      if (isEnumError || isColumnError) {
        // Fetch rift using raw SQL, then fetch MilestoneRelease separately
        const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT id, "buyerId", "sellerId", "itemType"::text as "itemType", 
                 "allowsPartialRelease", milestones, status::text as status,
                 "autoReleaseAt", "autoReleaseScheduled"
          FROM "EscrowTransaction"
          WHERE id = $1
        `, id)
        
        if (!fetchedRifts || fetchedRifts.length === 0) {
          return NextResponse.json(
            { error: 'Rift not found' },
            { status: 404 }
          )
        }
        
        const fetchedRift = fetchedRifts[0]
        
        // Fetch MilestoneRelease separately
        const milestoneReleases = await prisma.milestoneRelease.findMany({
          where: { riftId: id },
          orderBy: { milestoneIndex: 'asc' },
        })
        
        // Map itemType
        const mapItemType = (dbType: string): string => {
          if (dbType === 'TICKETS') return 'OWNERSHIP_TRANSFER'
          if (dbType === 'DIGITAL' || dbType === 'LICENSE_KEYS') return 'DIGITAL_GOODS'
          return dbType
        }
        
        rift = {
          ...fetchedRift,
          itemType: mapItemType(fetchedRift.itemType),
          MilestoneRelease: milestoneReleases,
        }
      } else {
        throw findError
      }
    }

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    // Verify user is buyer or seller
    if (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Verify this is a service rift with partial release
    if (rift.itemType !== 'SERVICES' || !rift.allowsPartialRelease) {
      return NextResponse.json(
        { error: 'This rift does not support milestone-based releases' },
        { status: 400 }
      )
    }

    const milestones = (rift.milestones as Array<{
      title: string
      description?: string
      deliverables?: string
      amount: number
      dueDate: string
      reviewWindowDays?: number
      revisionLimit?: number
      dealType?: string
    }>) || []

    const revisionEvents = await prisma.rift_events.findMany({
      where: {
        riftId: id,
        eventType: 'MILESTONE_REVISION_REQUESTED',
      },
      select: {
        payload: true,
      },
    })

    const revisionCounts = revisionEvents.reduce<Record<number, number>>((acc, event) => {
      const milestoneIndex = (event.payload as any)?.milestoneIndex
      if (typeof milestoneIndex === 'number') {
        acc[milestoneIndex] = (acc[milestoneIndex] || 0) + 1
      }
      return acc
    }, {})

    // Map milestones with release status
    const nextMilestoneIndex = milestones.findIndex((_, idx) =>
      !rift.MilestoneRelease.find((r: any) => r.milestoneIndex === idx && r.status === 'RELEASED')
    )
    const activeMilestoneIndex = nextMilestoneIndex === -1 ? null : nextMilestoneIndex

    const milestonesWithStatus = milestones.map((milestone, index) => {
      const release = rift.MilestoneRelease.find(
        (r: any) => r.milestoneIndex === index && r.status === 'RELEASED'
      )

      return {
        index,
        title: milestone.title,
        description: milestone.description || '',
        deliverables: milestone.deliverables || '',
        amount: milestone.amount,
        dueDate: milestone.dueDate,
        reviewWindowDays: milestone.reviewWindowDays ?? 3,
        revisionLimit: milestone.revisionLimit ?? 1,
        dealType: milestone.dealType || null,
        revisionRequests: revisionCounts[index] || 0,
        reviewWindowEndsAt:
          release?.releasedAt ||
          (index === activeMilestoneIndex && rift.autoReleaseAt ? rift.autoReleaseAt : null),
        released: !!release,
        releaseDate: release?.releasedAt || null,
        sellerNet: release?.sellerNet || null,
      }
    })

    const totalReleased = milestonesWithStatus.filter((m) => m.released).length
    const allReleased = totalReleased === milestones.length

    return NextResponse.json({
      milestones: milestonesWithStatus,
      totalMilestones: milestones.length,
      releasedMilestones: totalReleased,
      allReleased,
      riftStatus: rift.status,
      isBuyer: rift.buyerId === auth.userId,
      activeMilestoneIndex,
      autoReleaseAt: rift.autoReleaseAt,
      autoReleaseScheduled: rift.autoReleaseScheduled,
    })
  } catch (error: any) {
    console.error('Get milestones error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

