import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { updateMetricsOnDisputeResolved } from '@/lib/risk/metrics'
import { sendDisputeResolvedEmail } from '@/lib/email'

/**
 * POST /api/admin/disputes/[id]/resolve-seller
 * Admin resolves dispute in favor of seller
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
        buyerId: true,
        sellerId: true,
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
      .update({ status: 'resolved_seller' })
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
      action_type: 'resolved_seller',
      note: note || 'Resolved in favor of seller',
    })

    // Restore rift to eligible state using proper state transition
    const { transitionRiftState } = await import('@/lib/rift-state')
    
    // Transition from DISPUTED to appropriate status
    // First transition to RESOLVED, then to RELEASED if eligible
    try {
      await transitionRiftState(dispute.rift_id, 'RESOLVED', {
        userId: auth.userId,
        reason: 'Dispute resolved in favor of seller',
      })
      
      // Then transition to RELEASED to make funds available
      await transitionRiftState(dispute.rift_id, 'RELEASED', {
        userId: auth.userId,
        reason: 'Admin resolved dispute - releasing funds to seller',
      })
    } catch (transitionError: any) {
      // If transition fails, try direct update as fallback
      console.error('State transition error, using fallback:', transitionError)
      await prisma.riftTransaction.update({
        where: { id: dispute.rift_id },
        data: {
          status: 'RELEASED',
          releaseEligibleAt: new Date(),
        },
      })
    }

    // Update risk metrics (dispute resolved in favor of seller = buyer lost)
    try {
      await updateMetricsOnDisputeResolved(
        disputeId,
        dispute.rift_id,
        rift.buyerId,
        rift.sellerId,
        'resolved_seller'
      )
    } catch (error) {
      console.error(`Error updating dispute resolution metrics:`, error)
      // Don't fail resolution if metrics update fails
    }

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      dispute.rift_id,
      RiftEventActorType.ADMIN,
      auth.userId,
      'DISPUTE_RESOLVED',
      {
        disputeId,
        winner: 'seller',
        note: note || '',
      },
      requestMeta
    )

    // Send email notifications (not in chat)
    try {
      const rift = await prisma.riftTransaction.findUnique({
        where: { id: dispute.rift_id },
        include: {
          buyer: true,
          seller: true,
        },
      })
      
      if (rift) {
        await sendDisputeResolvedEmail(
          rift.buyer.email,
          rift.seller.email,
          dispute.rift_id,
          rift.itemTitle || 'Rift Transaction',
          'seller',
          note || undefined
        )
      }
    } catch (emailError) {
      console.error('Error sending dispute resolution email:', emailError)
      // Don't fail the resolution if email fails
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Resolve seller error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

