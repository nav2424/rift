import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { computeReleaseEligibility } from '@/lib/release-engine'

/**
 * GET /api/rifts/[id]/release/check-eligibility
 * Check if a Rift is eligible for release (for UI display)
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

    const { id: riftId } = await params
    const userId = auth.userId

    // Get rift and verify access
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check eligibility
    const eligibility = await computeReleaseEligibility(riftId)

    return NextResponse.json(eligibility)
  } catch (error: any) {
    console.error('Check eligibility error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

