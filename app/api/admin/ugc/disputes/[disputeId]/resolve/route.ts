/**
 * Admin resolve UGC dispute (RELEASE_TO_CREATOR, REFUND_TO_BRAND, SPLIT, REQUIRE_REVISION).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { adminResolveDispute } from '@/lib/ugc/disputes'
import type { DisputeOutcome } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || (session.user as { role?: string })?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { disputeId } = await params
    const body = await request.json()
    const { outcome, decisionNote, amounts } = body

    const validOutcomes: DisputeOutcome[] = ['RELEASE_TO_CREATOR', 'REFUND_TO_BRAND', 'SPLIT', 'REQUIRE_REVISION']
    if (!outcome || !validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: 'Invalid outcome', allowed: validOutcomes },
        { status: 400 }
      )
    }
    if (!decisionNote?.trim()) {
      return NextResponse.json({ error: 'decisionNote is required' }, { status: 400 })
    }
    if (outcome === 'SPLIT' && (!Array.isArray(amounts) || amounts.length !== 2)) {
      return NextResponse.json(
        { error: 'For SPLIT, amounts must be [amountToCreator, amountToBrand]' },
        { status: 400 }
      )
    }

    await adminResolveDispute({
      disputeId,
      adminUserId: session.user.id,
      outcome: outcome as DisputeOutcome,
      decisionNote: decisionNote.trim(),
      amounts: outcome === 'SPLIT' ? [Number(amounts[0]), Number(amounts[1])] : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin UGC resolve dispute error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
