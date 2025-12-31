/**
 * GET /api/rifts/[id]/vault/evidence-packet
 * Generate evidence packet for disputes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { generateEvidencePacket } from '@/lib/vault/intelligence'

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

    // Verify access
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const isBuyer = rift.buyerId === auth.userId
    const isSeller = rift.sellerId === auth.userId
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate evidence packet
    const packet = await generateEvidencePacket(riftId)

    return NextResponse.json(packet)
  } catch (error: any) {
    console.error('Generate evidence packet error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

