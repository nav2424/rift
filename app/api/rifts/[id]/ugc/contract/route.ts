/**
 * Get UGC contract for a deal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

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
      select: {
        buyerId: true,
        sellerId: true,
        Contract: true,
        ContractAmendment: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!rift) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (rift.buyerId !== auth.userId && rift.sellerId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!rift.Contract) return NextResponse.json({ error: 'No contract for this deal' }, { status: 404 })

    return NextResponse.json({
      contract: rift.Contract,
      amendments: rift.ContractAmendment,
    })
  } catch (error: any) {
    console.error('UGC contract get error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
