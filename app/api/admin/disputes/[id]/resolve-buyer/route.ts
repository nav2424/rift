import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { RiftEventActorType } from '@prisma/client'
import Stripe from 'stripe'
import { updateMetricsOnDisputeResolved } from '@/lib/risk/metrics'

/**
 * POST /api/admin/disputes/[id]/resolve-buyer
 * Admin resolves dispute in favor of buyer (triggers refund)
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

    // Get rift
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        id: true,
        stripePaymentIntentId: true,
        stripeChargeId: true,
        subtotal: true,
        buyerFee: true,
        currency: true,
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
      .update({ status: 'resolved_buyer' })
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
      action_type: 'resolved_buyer',
      note: note || 'Resolved in favor of buyer',
    })

    // Process refund via Stripe
    let refundResult: any = null
    if (rift.stripeChargeId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2024-12-18.acacia',
        })

        // Refund the full amount (subtotal + buyer fee)
        const refundAmount = Math.round((rift.subtotal + (rift.buyerFee || 0)) * 100) // Convert to cents

        const refund = await stripe.refunds.create({
          charge: rift.stripeChargeId,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            riftId: rift.id,
            disputeId,
            reason: 'admin_resolution',
          },
        })

        refundResult = {
          success: true,
          refundId: refund.id,
          amount: refund.amount / 100,
        }
      } catch (stripeError: any) {
        console.error('Stripe refund error:', stripeError)
        refundResult = {
          success: false,
          error: stripeError.message,
        }
      }
    }

    // Update rift status to refunded
    await prisma.riftTransaction.update({
      where: { id: dispute.rift_id },
      data: {
        status: 'REFUNDED',
      },
    })

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      dispute.rift_id,
      RiftEventActorType.ADMIN,
      auth.userId,
      'DISPUTE_RESOLVED',
      {
        disputeId,
        winner: 'buyer',
        note: note || '',
        refund: refundResult,
      },
      requestMeta
    )

    // Update risk metrics (dispute resolved in favor of buyer = seller lost)
    try {
      await updateMetricsOnDisputeResolved(
        disputeId,
        dispute.rift_id,
        rift.buyerId,
        rift.sellerId,
        'resolved_buyer'
      )
    } catch (error) {
      console.error(`Error updating dispute resolution metrics:`, error)
      // Don't fail resolution if metrics update fails
    }

    // Post system message
    await postSystemMessage(
      dispute.rift_id,
      'Dispute resolved in favor of buyer. Refund has been processed.'
    )

    return NextResponse.json({
      success: true,
      refund: refundResult,
    })
  } catch (error: any) {
    console.error('Resolve buyer error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

