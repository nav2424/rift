import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { autoTriageDispute } from '@/lib/dispute-auto-triage'
import { RiftEventActorType } from '@prisma/client'
import { isDisputesRestricted } from '@/lib/risk/enforcement'
import { updateMetricsOnDisputeSubmitted } from '@/lib/risk/metrics'
import { sendDisputeRaisedEmail } from '@/lib/email'

/**
 * POST /api/disputes/[id]/submit
 * Submit dispute for review (validates requirements, runs auto-triage)
 */
export async function POST(
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

    // Check user verification status before allowing dispute submission
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        phoneVerified: true,
        email: true,
        phone: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Require email and phone verification to submit disputes
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'Email verification required',
          message: 'You must verify your email address before submitting a dispute. Please verify your email in Settings.',
        },
        { status: 403 }
      )
    }

    if (!user.phoneVerified) {
      return NextResponse.json(
        { 
          error: 'Phone verification required',
          message: 'You must verify your phone number before submitting a dispute. Please verify your phone in Settings.',
        },
        { status: 403 }
      )
    }

    // Get dispute and verify buyer owns it
    const supabase = createServerClient()
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

    if (dispute.opened_by !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if disputes are restricted for this user
    const restriction = await isDisputesRestricted(userId)
    if (restriction.restricted) {
      const untilDate = restriction.until ? new Date(restriction.until).toLocaleDateString() : 'a future date'
      return NextResponse.json(
        { 
          error: 'Disputes are temporarily restricted due to prior dispute activity. Contact support.',
          restrictedUntil: restriction.until?.toISOString(),
        },
        { status: 403 }
      )
    }

    if (dispute.status !== 'draft') {
      return NextResponse.json(
        { error: 'Dispute is not in draft status' },
        { status: 400 }
      )
    }

    // Validate submission requirements
    if (!dispute.reason || dispute.reason === 'other') {
      return NextResponse.json(
        { error: 'Dispute reason is required' },
        { status: 400 }
      )
    }

    if (!dispute.summary || dispute.summary.length < 200) {
      return NextResponse.json(
        { error: 'Summary must be at least 200 characters' },
        { status: 400 }
      )
    }

    if (!dispute.sworn_declaration || dispute.sworn_declaration_text !== 'I CONFIRM') {
      return NextResponse.json(
        { error: 'Sworn declaration is required' },
        { status: 400 }
      )
    }

    // Check evidence requirements
    const { data: evidence } = await supabase
      .from('dispute_evidence')
      .select('id, type')
      .eq('dispute_id', disputeId)

    const evidenceCount = evidence?.length || 0
    const hasFileEvidence = evidence?.some(e => ['image', 'pdf', 'file'].includes(e.type)) || false
    const hasTextEvidence = evidence?.some(e => ['text', 'link'].includes(e.type)) || false

    // Require evidence for certain reasons
    if (['not_received', 'not_as_described'].includes(dispute.reason)) {
      if (!hasFileEvidence && (!hasTextEvidence || evidenceCount < 2)) {
        return NextResponse.json(
          { error: 'Evidence required: at least 1 file upload OR 2 text/link entries with detailed description' },
          { status: 400 }
        )
      }
    }

    // Get rift for auto-triage
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        id: true,
        itemType: true,
        status: true,
        eventDateTz: true,
      },
    })

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    // Run auto-triage
    // Use Auto-Triage system
    const triageResult = await autoTriageDispute(
      dispute.rift_id,
      dispute.reason,
      dispute.category_snapshot
    )

    // Update dispute with auto-triage result
    let newStatus = 'submitted'
    if (triageResult.decision === 'auto_reject') {
      newStatus = 'auto_rejected'
    } else if (triageResult.decision === 'needs_review') {
      newStatus = 'under_review'
    }

    const { data: updatedDispute, error: updateError } = await supabase
      .from('disputes')
      .update({
        status: newStatus,
        auto_triage: {
          eligible: true,
          decision: triageResult.decision,
          signals: triageResult.signals,
          rationale: triageResult.rationale,
        },
      })
      .eq('id', disputeId)
      .select()
      .single()

    if (updateError || !updatedDispute) {
      console.error('Update dispute error:', updateError)
      return NextResponse.json(
        { error: 'Failed to submit dispute', details: updateError?.message },
        { status: 500 }
      )
    }

    // Create dispute action
    await supabase.from('dispute_actions').insert({
      dispute_id: disputeId,
      actor_id: userId,
      actor_role: 'buyer',
      action_type: 'submitted',
      note: 'Dispute submitted for review',
    })

    // If auto-rejected, create auto-rejected action
    if (newStatus === 'auto_rejected') {
      await supabase.from('dispute_actions').insert({
        dispute_id: disputeId,
        actor_id: null,
        actor_role: 'system',
        action_type: 'auto_rejected',
        note: triageResult.rationale,
        meta: { signals: triageResult.signals },
      })

      // Log event
      const requestMeta = extractRequestMetadata(request)
      await logEvent(
        dispute.rift_id,
        RiftEventActorType.SYSTEM,
        null,
        'DISPUTE_AUTO_REJECTED',
        {
          disputeId,
          reason: dispute.reason,
          signals: triageResult.signals,
          rationale: triageResult.rationale,
        },
        requestMeta
      )

      // Restore rift status (keep it in delivered/in_progress, not disputed)
      // Don't change status if auto-rejected
    } else {
      // Set rift status to disputed
      await prisma.riftTransaction.update({
        where: { id: dispute.rift_id },
        data: { status: 'DISPUTED' },
      })

      // Create moved_to_review action if needed
      if (newStatus === 'under_review') {
        await supabase.from('dispute_actions').insert({
          dispute_id: disputeId,
          actor_id: null,
          actor_role: 'system',
          action_type: 'moved_to_review',
          note: 'Moved to review queue',
        })
      }
    }

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      dispute.rift_id,
      RiftEventActorType.BUYER,
      userId,
      'DISPUTE_SUBMITTED',
      {
        disputeId,
        reason: dispute.reason,
        autoTriageDecision: triageResult.decision,
      },
      requestMeta
    )

    // Update risk metrics (dispute submitted)
    try {
      await updateMetricsOnDisputeSubmitted(userId)
    } catch (error) {
      console.error(`Error updating dispute metrics for user ${userId}:`, error)
      // Don't fail dispute submission if metrics update fails
    }

    // Don't post system messages - emails are sent instead (see below)

    // Send email notifications (only if dispute was successfully submitted, not auto-rejected)
    if (newStatus !== 'auto_rejected') {
      try {
        // Get rift details for email
        const rift = await prisma.riftTransaction.findUnique({
          where: { id: dispute.rift_id },
          include: {
            buyer: true,
            seller: true,
          },
        })

        // Get admin email
        const admin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
        })

        if (rift && admin) {
          await sendDisputeRaisedEmail(
            rift.buyer.email,
            rift.seller.email,
            admin.email,
            dispute.rift_id,
            rift.itemTitle,
            dispute.summary || dispute.reason || 'No reason provided',
            {
              disputeType: dispute.reason || 'OTHER',
              disputeId: disputeId,
              riftNumber: rift.riftNumber,
              subtotal: rift.subtotal,
              currency: rift.currency,
              itemDescription: rift.itemDescription,
              itemType: rift.itemType,
              shippingAddress: rift.shippingAddress,
              buyerName: rift.buyer.name,
              sellerName: rift.seller.name,
              buyerEmail: rift.buyer.email,
              sellerEmail: rift.seller.email,
              createdAt: updatedDispute?.created_at || dispute.created_at || new Date(),
              summary: dispute.summary || null,
            }
          )
        }
      } catch (emailError) {
        // Log email error but don't fail the dispute submission
        console.error('Error sending dispute email notification:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      dispute: updatedDispute,
      autoTriage: triageResult,
    })
  } catch (error: any) {
    console.error('Submit dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

