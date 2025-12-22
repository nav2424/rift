import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'

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
    const userId = auth.userId
    const userRole = auth.userRole

    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Check access
    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId
    const isAdmin = userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch timeline events and disputes separately to avoid schema mismatch
    // Get ALL timeline events - no filters, no limits
    const [timelineEvents, disputes] = await Promise.all([
      prisma.timelineEvent.findMany({
        where: { escrowId: id },
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // Chronological order
        // No limit - get all events
      }),
      prisma.dispute.findMany({
        where: { escrowId: id },
        include: {
          raisedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      ...rift,
      eventDateTz: rift.eventDateTz?.toISOString() || null,
      timelineEvents,
      disputes,
    })
  } catch (error: any) {
    console.error('Get rift error:', error)
    const errorMessage = error?.message || 'Internal server error'
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? error?.stack || errorMessage
      : undefined
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorMessage,
        ...(errorDetails && { details: errorDetails })
      },
      { status: 500 }
    )
  }
}

