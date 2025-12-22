/**
 * Stripe Dispute Handling
 * 
 * Handles Stripe dispute/chargeback lifecycle events:
 * - dispute.created: Freeze funds, update risk, log events
 * - dispute.updated: Update status, evidence due dates
 * - dispute.closed: Handle resolution (won/lost)
 */

import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { updateMetricsOnChargeback } from '@/lib/risk/metrics'
import { isFundsFrozen } from '@/lib/risk/enforcement'

/**
 * Handle Stripe dispute created
 */
export async function handleStripeDisputeCreated(
  dispute: any,
  requestMeta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const chargeId = dispute.charge
  if (!chargeId) {
    console.warn('Dispute missing charge ID')
    return
  }

  // Find rift by charge ID
  const rift = await prisma.riftTransaction.findFirst({
    where: { stripeChargeId: chargeId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      subtotal: true,
      currency: true,
      status: true,
    },
  })

  if (!rift) {
    console.warn(`Rift not found for dispute charge: ${chargeId}`)
    return
  }

  const supabase = createServerClient()

  // Extract dispute details
  const disputeId = dispute.id
  const paymentIntentId = dispute.payment_intent || null
  const amountCents = dispute.amount
  const currency = dispute.currency || 'cad'
  const status = dispute.status || 'needs_response'
  const reason = dispute.reason || null
  const evidenceDueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000)
    : null

  // Store minimal subset of dispute object (no full card data)
  const rawDispute = {
    id: dispute.id,
    amount: dispute.amount,
    currency: dispute.currency,
    status: dispute.status,
    reason: dispute.reason,
    evidence_details: {
      due_by: dispute.evidence_details?.due_by,
      has_evidence: dispute.evidence_details?.has_evidence,
      past_due: dispute.evidence_details?.past_due,
    },
    created: dispute.created,
  }

  // Insert/upsert stripe_disputes row
  await supabase.from('stripe_disputes').upsert({
    stripe_dispute_id: disputeId,
    stripe_charge_id: chargeId,
    stripe_payment_intent_id: paymentIntentId,
    rift_id: rift.id,
    buyer_id: rift.buyerId,
    seller_id: rift.sellerId,
    amount_cents: amountCents,
    currency: currency.toUpperCase(),
    status: status,
    reason: reason,
    evidence_due_by: evidenceDueBy?.toISOString() || null,
    raw: rawDispute,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'stripe_dispute_id',
  })

  // Apply enforcement: Freeze funds
  await supabase.from('user_restrictions').upsert({
    user_id: rift.buyerId,
    funds_frozen: true,
    frozen_reason: `Stripe dispute created: ${disputeId}`,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id',
  })

  // Also freeze seller payouts for this specific rift
  // Update rift status to indicate frozen due to dispute
  await prisma.riftTransaction.update({
    where: { id: rift.id },
    data: {
      status: 'DISPUTED', // Or create a 'FROZEN' status if preferred
    },
  })

  // Write enforcement action
  await supabase.from('enforcement_actions').insert({
    user_id: rift.buyerId,
    action_type: 'freeze_funds',
    reason: `Stripe dispute created: ${disputeId}. Funds frozen pending resolution.`,
    meta: {
      stripe_dispute_id: disputeId,
      rift_id: rift.id,
      amount_cents: amountCents,
    },
  })

  // Update risk metrics
  try {
    const amount = amountCents / 100
    await updateMetricsOnChargeback(rift.buyerId, amount)
  } catch (error) {
    console.error(`Error updating chargeback metrics:`, error)
  }

  // Log events
  await logEvent(
    rift.id,
    RiftEventActorType.SYSTEM,
    null,
    'FUNDS_FROZEN',
    {
      source: 'stripe_dispute',
      stripe_dispute_id: disputeId,
      status: status,
      amount_cents: amountCents,
    },
    requestMeta
  )

  await logEvent(
    rift.id,
    RiftEventActorType.SYSTEM,
    null,
    'CHARGEBACK_OR_DISPUTE_CREATED',
    {
      stripe_dispute_id: disputeId,
      stripe_charge_id: chargeId,
      status: status,
      reason: reason,
      evidence_due_by: evidenceDueBy?.toISOString() || null,
    },
    requestMeta
  )

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      escrowId: rift.id,
      type: 'CHARGEBACK',
      message: `Stripe dispute created: ${rift.currency} ${(amountCents / 100).toFixed(2)}. Status: ${status}`,
    },
  })
}

/**
 * Handle Stripe dispute updated
 */
export async function handleStripeDisputeUpdated(
  dispute: any,
  requestMeta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const disputeId = dispute.id
  const supabase = createServerClient()

  // Get existing dispute record
  const { data: existing } = await supabase
    .from('stripe_disputes')
    .select('rift_id, status')
    .eq('stripe_dispute_id', disputeId)
    .maybeSingle()

  if (!existing) {
    console.warn(`Stripe dispute ${disputeId} not found in database`)
    return
  }

  const status = dispute.status || existing.status
  const reason = dispute.reason || null
  const evidenceDueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000)
    : null

  // Update dispute record
  await supabase
    .from('stripe_disputes')
    .update({
      status: status,
      reason: reason,
      evidence_due_by: evidenceDueBy?.toISOString() || null,
      raw: {
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
        evidence_details: dispute.evidence_details,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_dispute_id', disputeId)

  // Log event
  if (existing.rift_id) {
    await logEvent(
      existing.rift_id,
      RiftEventActorType.SYSTEM,
      null,
      'CHARGEBACK_OR_DISPUTE_UPDATED',
      {
        stripe_dispute_id: disputeId,
        status: status,
        reason: reason,
        evidence_due_by: evidenceDueBy?.toISOString() || null,
      },
      requestMeta
    )
  }
}

/**
 * Handle Stripe dispute closed
 */
export async function handleStripeDisputeClosed(
  dispute: any,
  requestMeta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const disputeId = dispute.id
  const supabase = createServerClient()

  // Get existing dispute record
  const { data: existing } = await supabase
    .from('stripe_disputes')
    .select('rift_id, buyer_id, seller_id, status')
    .eq('stripe_dispute_id', disputeId)
    .maybeSingle()

  if (!existing) {
    console.warn(`Stripe dispute ${disputeId} not found in database`)
    return
  }

  const status = dispute.status // Should be 'won' or 'lost'
  const outcome = status === 'won' ? 'won' : 'lost'

  // Update dispute record
  await supabase
    .from('stripe_disputes')
    .update({
      status: status,
      raw: {
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_dispute_id', disputeId)

  if (!existing.rift_id) {
    return
  }

  // If won (seller won, buyer lost):
  // - Unfreeze this specific rift (but keep buyer restrictions if other reasons exist)
  // - Restore rift to eligible state
  if (outcome === 'won') {
    // Check if buyer has other reasons to be frozen
    const buyerFrozen = await isFundsFrozen(existing.buyer_id)
    
    // Unfreeze this specific rift by restoring status
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: existing.rift_id },
      select: { status: true, itemType: true },
    })

    if (rift) {
      // Restore to appropriate status based on item type
      let newStatus = 'DELIVERED_PENDING_RELEASE'
      if (rift.itemType === 'DIGITAL' || rift.itemType === 'SERVICES' || rift.itemType === 'TICKETS') {
        newStatus = 'DELIVERED_PENDING_RELEASE'
      }

      await prisma.riftTransaction.update({
        where: { id: existing.rift_id },
        data: { status: newStatus },
      })
    }

    // Note: We do NOT auto-unban the buyer. Keep restrictions in place.
    // Admin can manually review and remove restrictions if needed.
  }

  // If lost (seller lost, buyer won):
  // - Keep buyer restrictions (they won, but pattern may still indicate abuse)
  // - Keep rift frozen/refunded
  // - Seller may need to be restricted if pattern emerges

  // Log event
  await logEvent(
    existing.rift_id,
    RiftEventActorType.SYSTEM,
    null,
    'CHARGEBACK_OR_DISPUTE_CLOSED',
    {
      stripe_dispute_id: disputeId,
      outcome: outcome,
      status: status,
    },
    requestMeta
  )

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      escrowId: existing.rift_id,
      type: outcome === 'won' ? 'DISPUTE_RESOLVED' : 'CHARGEBACK',
      message: `Stripe dispute ${outcome === 'won' ? 'resolved in favor of seller' : 'lost - refund processed'}`,
    },
  })
}

