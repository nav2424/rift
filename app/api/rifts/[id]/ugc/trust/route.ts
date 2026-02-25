/**
 * Trust panel data (behavioral reputation rollups) for both parties in deal room.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { computeAndStoreReputationRollup, getReputationRollup } from '@/lib/ugc/reputation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
      select: { buyerId: true, sellerId: true },
    })
    if (!rift) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Compute on demand (cheap v1) then fetch
    await Promise.all([
      computeAndStoreReputationRollup(rift.sellerId, 'CREATOR'),
      computeAndStoreReputationRollup(rift.buyerId, 'BRAND'),
    ])

    const [creator, brand] = await Promise.all([
      getReputationRollup(rift.sellerId, 'CREATOR'),
      getReputationRollup(rift.buyerId, 'BRAND'),
    ])

    return NextResponse.json({
      creator,
      brand,
      creatorUserId: rift.sellerId,
      brandUserId: rift.buyerId,
    })
  } catch (error: any) {
    console.error('UGC trust route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

