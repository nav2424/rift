/**
 * Create UGC deal: create deal room + apply UGC template + create milestones.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createDealRoom, applyContractTemplate, createMilestonesFromContract } from '@/lib/ugc/deal-room'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      brandId,
      creatorId,
      itemTitle,
      itemDescription,
      totalAmount,
      currency,
      contractOverrides,
    } = body

    if (!itemTitle || !itemDescription || totalAmount == null || totalAmount <= 0) {
      return NextResponse.json(
        { error: 'itemTitle, itemDescription, and totalAmount (positive) are required' },
        { status: 400 }
      )
    }

    const creatorUserId = creatorId ?? auth.userId
    const brandUserId = brandId ?? (creatorId && creatorId !== auth.userId ? auth.userId : null)
    if (!brandUserId || !creatorUserId || brandUserId === creatorUserId) {
      return NextResponse.json(
        { error: 'Two distinct parties (brand and creator) are required' },
        { status: 400 }
      )
    }

    const { riftId, riftNumber } = await createDealRoom({
      brandId: brandUserId,
      creatorId: creatorUserId,
      itemTitle,
      itemDescription,
      totalAmount: Number(totalAmount),
      currency: currency || 'CAD',
      contractOverrides,
    })

    await applyContractTemplate(riftId, 'ugc_creation_v1', contractOverrides)
    const { milestoneIds } = await createMilestonesFromContract(riftId)

    return NextResponse.json(
      { riftId, riftNumber, milestoneIds },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('UGC create deal error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
