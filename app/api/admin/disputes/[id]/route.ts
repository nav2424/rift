import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { analyzeDisputeText, generateDisputeSummary } from '@/lib/ai/dispute-analysis'
import { extractAndSummarizeEvidence } from '@/lib/ai/evidence-extraction'

/**
 * GET /api/admin/disputes/[id]
 * Get full dispute case details for admin review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId } = await params

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

    // Get evidence
    const { data: evidence } = await supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })

    // Get actions (audit trail)
    const { data: actions } = await supabase
      .from('dispute_actions')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })

    // Get rift with full details
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            phoneVerified: true,
            idVerified: true,
            bankVerified: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            phoneVerified: true,
            idVerified: true,
            bankVerified: true,
          },
        },
        rift_events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Get delivery proof based on category
    let deliveryProof: any = null
    if (dispute.category_snapshot === 'DIGITAL') {
      const { data: delivery } = await supabase
        .from('digital_deliveries')
        .select('*')
        .eq('rift_id', dispute.rift_id)
        .single()

      const { data: views } = await supabase
        .from('delivery_views')
        .select('*')
        .eq('rift_id', dispute.rift_id)
        .order('started_at', { ascending: true })

      deliveryProof = {
        delivery,
        views,
      }
    } else if (dispute.category_snapshot === 'TICKETS') {
      const { data: transfer } = await supabase
        .from('ticket_transfers')
        .select('*')
        .eq('rift_id', dispute.rift_id)
        .single()

      deliveryProof = { transfer }
    }

    // Get chat messages (from conversations)
    // Note: This would need to fetch from the messaging system
    // For now, we'll return empty array and let the frontend fetch it
    const chatMessages: any[] = []

    // Get opened by user
    const openedBy = await prisma.user.findUnique({
      where: { id: dispute.opened_by },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        phoneVerified: true,
        idVerified: true,
        bankVerified: true,
      },
    })

    // AI Dispute Analysis
    let aiAnalysis = null
    let evidenceSummary = null
    try {
      aiAnalysis = await analyzeDisputeText(disputeId, dispute.summary || '', dispute.rift_id)
      evidenceSummary = await extractAndSummarizeEvidence(disputeId, dispute.rift_id)
    } catch (error) {
      console.error('AI dispute analysis failed:', error)
      // Continue without AI analysis if it fails
    }

    return NextResponse.json({
      dispute: {
        ...dispute,
        openedByUser: openedBy,
      },
      evidence: evidence || [],
      actions: actions || [],
      rift,
      deliveryProof,
      chatMessages,
      aiAnalysis, // AI-powered dispute analysis
      evidenceSummary, // AI-extracted evidence summary
    })
  } catch (error: any) {
    console.error('Get dispute case error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

