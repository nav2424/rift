/**
 * Admin Verification Endpoint
 * Manually trigger verification pipeline or re-verify assets
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyRiftProofs, verifyVaultAsset } from '@/lib/vault-verification'
import { transitionRiftState } from '@/lib/rift-state'

/**
 * POST /api/admin/vault/[riftId]/verify
 * Trigger verification pipeline for a Rift
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { riftId } = await params
    const body = await request.json()
    const { assetId } = body

    if (assetId) {
      // Verify single asset
      const result = await verifyVaultAsset(assetId)
      return NextResponse.json({ result })
    } else {
      // Verify all assets for Rift
      const result = await verifyRiftProofs(riftId)

      // Auto-route to UNDER_REVIEW if needed
      if (result.shouldRouteToReview) {
        // Check current status
        const { prisma } = await import('@/lib/prisma')
        const rift = await prisma.riftTransaction.findUnique({
          where: { id: riftId },
        })

        if (rift && rift.status === 'PROOF_SUBMITTED') {
          await transitionRiftState(riftId, 'UNDER_REVIEW', {
            userId: session.user.id,
            reason: 'Auto-routed to review due to verification issues',
          })
        }
      }

      return NextResponse.json({ result })
    }
  } catch (error: any) {
    console.error('Admin verify error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify' },
      { status: 500 }
    )
  }
}

