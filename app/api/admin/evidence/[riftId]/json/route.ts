import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { generateEvidencePacket } from '@/lib/evidence-packet'

/**
 * GET /api/admin/evidence/[riftId]/json
 * Get evidence packet as JSON (download)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { riftId } = await params
    const { searchParams } = new URL(request.url)
    const stripeDisputeId = searchParams.get('disputeId') || undefined

    // Generate packet
    const packet = await generateEvidencePacket(riftId, stripeDisputeId)

    // Return as downloadable JSON
    return NextResponse.json(packet, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="evidence-${riftId}-${Date.now()}.json"`,
      },
    })
  } catch (error: any) {
    console.error('Get evidence JSON error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

