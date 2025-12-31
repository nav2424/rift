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

    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        milestoneReleases: {
          orderBy: {
            milestoneIndex: 'asc',
          },
        },
      },
    })

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
      amount: number
      dueDate: string
    }>) || []

    // Map milestones with release status
    const milestonesWithStatus = milestones.map((milestone, index) => {
      const release = rift.milestoneReleases.find(
        (r) => r.milestoneIndex === index && r.status === 'RELEASED'
      )

      return {
        index,
        title: milestone.title,
        description: milestone.description || '',
        amount: milestone.amount,
        dueDate: milestone.dueDate,
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
    })
  } catch (error: any) {
    console.error('Get milestones error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

