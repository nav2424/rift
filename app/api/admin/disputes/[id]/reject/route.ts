import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType, EscrowStatus } from '@prisma/client'
import { sendDisputeResolvedEmail } from '@/lib/email'

/**
 * POST /api/admin/disputes/[id]/reject
 * Admin rejects dispute as invalid
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId } = await params
    const body = await request.json()
    const { note } = body

    const supabase = createServerClient()

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('rift_id, status')
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    // Get rift to determine previous status
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        id: true,
        status: true,
        itemType: true,
        itemTitle: true,
        buyer: {
          select: {
            email: true,
          },
        },
        seller: {
          select: {
            email: true,
          },
        },
      },
    })

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    // Update dispute status
    const { error: updateError } = await supabase
      .from('disputes')
      .update({ status: 'rejected' })
      .eq('id', disputeId)

    if (updateError) {
      console.error('Update dispute error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update dispute', details: updateError.message },
        { status: 500 }
      )
    }

    // Create dispute action
    await supabase.from('dispute_actions').insert({
      dispute_id: disputeId,
      actor_id: auth.userId,
      actor_role: 'admin',
      action_type: 'rejected',
      note: note || 'Dispute rejected as invalid',
    })

    // Restore rift to eligible state using proper state transition
    const { transitionRiftState } = await import('@/lib/rift-state')
    
    try {
      // Transition from DISPUTED to RESOLVED, then to appropriate status
      await transitionRiftState(dispute.rift_id, 'RESOLVED', {
        userId: auth.userId,
        reason: 'Dispute rejected as invalid',
      })
      
      // Determine appropriate status based on previous state and item type
      // If proof was submitted, go back to PROOF_SUBMITTED or UNDER_REVIEW
      // Otherwise, go to RELEASED if eligible
      if (rift.status === 'DISPUTED') {
        // Check if proof exists
        const proofCount = await prisma.vaultAsset.count({
          where: { riftId: dispute.rift_id },
        })
        
        if (proofCount > 0) {
          // Has proof, go to PROOF_SUBMITTED or UNDER_REVIEW
          await transitionRiftState(dispute.rift_id, 'PROOF_SUBMITTED', {
            userId: auth.userId,
            reason: 'Dispute rejected - proof exists',
          })
        } else {
          // No proof, release if eligible
          await transitionRiftState(dispute.rift_id, 'RELEASED', {
            userId: auth.userId,
            reason: 'Dispute rejected - releasing funds',
          })
        }
      }
    } catch (transitionError: any) {
      // If transition fails, try direct update as fallback
      console.error('State transition error, using fallback:', transitionError)
      await prisma.riftTransaction.update({
        where: { id: dispute.rift_id },
        data: {
          status: 'PROOF_SUBMITTED',
          releaseEligibleAt: new Date(),
        },
      })
    }

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      dispute.rift_id,
      RiftEventActorType.ADMIN,
      auth.userId,
      'DISPUTE_REJECTED',
      {
        disputeId,
        note: note || '',
      },
      requestMeta
    )

    // Send email notifications (not in chat)
    if (rift) {
      try {
        await sendDisputeResolvedEmail(
          rift.buyer.email,
          rift.seller.email,
          dispute.rift_id,
          rift.itemTitle || 'Rift Transaction',
          'rejected',
          note || undefined
        )
      } catch (emailError) {
        console.error('Error sending dispute rejection email:', emailError)
        // Don't fail the rejection if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Reject dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

