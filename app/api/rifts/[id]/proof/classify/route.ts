/**
 * POST /api/rifts/[id]/proof/classify
 * Classify and validate proof assets
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { classifyProof } from '@/lib/ai/proof-classifier'

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
        itemType: true,
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Only seller or admin can classify proof
    if (rift.sellerId !== auth.userId && auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Classify each asset
    const classifications = await Promise.all(
      assetIds.map((assetId: string) =>
        classifyProof(assetId, rift.itemType).catch((error) => ({
          assetId,
          error: error.message,
        }))
      )
    )

    return NextResponse.json({
      classifications,
    })
  } catch (error: any) {
    console.error('Classify proof error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

