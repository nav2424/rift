/**
 * POST /api/rifts/[id]/proof/quality
 * Score proof quality for seller
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { scoreProofQuality } from '@/lib/seller/proof-builder'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: riftId } = await params
    const body = await request.json()
    const { assetIds } = body

    if (!assetIds || !Array.isArray(assetIds)) {
      return NextResponse.json(
        { error: 'assetIds array required' },
        { status: 400 }
      )
    }

    // Verify access
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Only seller or admin can check quality
    if (rift.sellerId !== auth.userId && auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Score proof quality
    const quality = await scoreProofQuality(riftId, assetIds)

    return NextResponse.json(quality)
  } catch (error: any) {
    console.error('Score proof quality error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

