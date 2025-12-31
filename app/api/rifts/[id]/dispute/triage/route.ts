/**
 * POST /api/rifts/[id]/dispute/triage
 * Triage a dispute (auto-route decision)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { triageDispute, generateDecisionAssistant } from '@/lib/ai/dispute-triage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can trigger triage
    if (auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: riftId } = await params
    const body = await request.json()
    const { disputeId } = body

    if (!disputeId) {
      return NextResponse.json(
        { error: 'disputeId required' },
        { status: 400 }
      )
    }

    // Triage dispute
    const triage = await triageDispute(disputeId, riftId)

    // Generate decision assistant
    const assistant = await generateDecisionAssistant(disputeId, riftId)

    return NextResponse.json({
      triage,
      assistant,
    })
  } catch (error: any) {
    console.error('Dispute triage error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

