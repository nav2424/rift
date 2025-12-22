import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { generateEvidencePacket, saveEvidencePacket } from '@/lib/evidence-packet'

/**
 * POST /api/admin/evidence/[riftId]/generate
 * Generate and save evidence packet for a rift
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { riftId } = await params
    const body = await request.json()
    const { stripeDisputeId } = body

    // Generate packet
    const packet = await generateEvidencePacket(riftId, stripeDisputeId)

    // Save packet
    const packetId = await saveEvidencePacket(
      riftId,
      packet,
      auth.userId,
      stripeDisputeId
    )

    return NextResponse.json({
      success: true,
      packetId,
      packet,
    })
  } catch (error: any) {
    console.error('Generate evidence packet error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

