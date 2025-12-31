import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/disputes/[id]/summary
 * Get dispute summary for user viewing (reason, summary, evidence)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId } = await params
    const userId = auth.userId

    const supabase = createServerClient()

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    // Verify user has access (either opened the dispute or is buyer/seller of the rift)
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift || (rift.buyerId !== userId && rift.sellerId !== userId && dispute.opened_by !== userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get evidence
    const { data: evidence } = await supabase
      .from('dispute_evidence')
      .select('type, file_name, text_content, url')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      reason: dispute.reason,
      summary: dispute.summary || '',
      evidence: (evidence || []).map(ev => ({
        type: ev.type,
        fileName: ev.file_name,
        textContent: ev.text_content,
        url: ev.url,
      })),
    })
  } catch (error: any) {
    console.error('Get dispute summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

