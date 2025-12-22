import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'

/**
 * Debug endpoint to check all timeline events for a rift
 * Helps identify missing events
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

    // Get all timeline events
    const events = await prisma.timelineEvent.findMany({
      where: { escrowId: id },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Get rift status and proof status
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      include: {
        proofs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json({
      riftId: id,
      riftStatus: rift?.status,
      latestProofStatus: rift?.proofs[0]?.status,
      totalEvents: events.length,
      events: events.map(e => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt,
        createdBy: e.createdBy?.name || e.createdBy?.email || 'System',
      })),
    })
  } catch (error: any) {
    console.error('Timeline debug error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
