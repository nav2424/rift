/**
 * GET /api/rifts/[id]/verification-status
 * Get the current verification status for a Rift
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { getRiftVerificationStatus } from '@/lib/queue/verification-queue'

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

    // Verify user has access to this rift
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Check if user is buyer, seller, or admin
    const isBuyer = rift.buyerId === auth.userId
    const isSeller = rift.sellerId === auth.userId
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get verification status
    const verificationStatus = await getRiftVerificationStatus(id)

    if (!verificationStatus) {
      return NextResponse.json({
        status: 'not_started',
        message: 'Verification has not been started',
      })
    }

    // Return status based on job state
    const response: any = {
      jobId: verificationStatus.jobId,
      state: verificationStatus.state,
      timestamp: verificationStatus.timestamp,
    }

    if (verificationStatus.state === 'completed') {
      response.status = 'completed'
      response.result = verificationStatus.result
      response.message = verificationStatus.result?.allPassed
        ? 'Verification completed successfully'
        : 'Verification completed with issues'
    } else if (verificationStatus.state === 'failed') {
      response.status = 'failed'
      response.error = verificationStatus.failedReason
      response.message = 'Verification failed'
    } else if (verificationStatus.state === 'active') {
      response.status = 'processing'
      response.progress = verificationStatus.progress
      response.message = 'Verification in progress...'
    } else {
      response.status = 'pending'
      response.message = 'Verification queued, waiting to start...'
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Get verification status error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

