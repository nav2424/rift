import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { transitionRiftState } from '@/lib/rift-state'
import { debitSellerOnChargeback } from '@/lib/wallet'
import { confirmPaymentIntent } from '@/lib/stripe'
import { sendStripeStatusChangeEmail } from '@/lib/email'
import { createActivity } from '@/lib/activity'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { applyRiskPolicy } from '@/lib/risk/computeRisk'
import { capturePolicyAcceptance } from '@/lib/policy-acceptance'

/**
 * Stripe webhook handler
 * Handles payment events, chargebacks, and payout events
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!stripe || !signature) {
    return NextResponse.json(
      { error: 'Stripe not configured or signature missing' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not set, skipping webhook verification')
    return NextResponse.json({ received: true })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any
        await handlePaymentSucceeded(paymentIntent, request)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any
        await handlePaymentFailed(paymentIntent)
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as any
        const requestMeta = extractRequestMetadata(request)
        const { handleStripeDisputeCreated } = await import('@/lib/stripe-disputes')
        await handleStripeDisputeCreated(dispute, requestMeta)
        break
      }

      case 'charge.dispute.updated': {
        const dispute = event.data.object as any
        const requestMeta = extractRequestMetadata(request)
        const { handleStripeDisputeUpdated } = await import('@/lib/stripe-disputes')
        await handleStripeDisputeUpdated(dispute, requestMeta)
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as any
        const requestMeta = extractRequestMetadata(request)
        const { handleStripeDisputeClosed } = await import('@/lib/stripe-disputes')
        await handleStripeDisputeClosed(dispute, requestMeta)
        break
      }

      // Legacy handler (keep for backward compatibility)
      case 'charge.dispute.created.legacy': {
        const dispute = event.data.object as any
        await handleChargebackCreated(dispute)
        break
      }

      case 'payout.paid': {
        const payout = event.data.object as any
        await handleTransferPaid(payout)
        break
      }

      case 'payout.failed': {
        const payout = event.data.object as any
        await handleTransferFailed(payout)
        break
      }

      case 'account.updated': {
        const account = event.data.object as any
        await handleAccountUpdated(account)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle payment succeeded
 */
async function handlePaymentSucceeded(paymentIntent: any, request?: NextRequest) {
  const riftId = paymentIntent.metadata?.escrowId
  if (!riftId) {
    console.warn('Payment intent missing escrowId metadata')
    return
  }

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      status: true,
      subtotal: true,
      currency: true,
      stripeChargeId: true,
      buyerId: true,
    },
  })

  if (!rift) {
    console.warn(`Rift not found: ${riftId}`)
    return
  }

  // Only transition if still in DRAFT
  if (rift.status === 'DRAFT') {
    await transitionRiftState(rift.id, 'FUNDED')
    
    // Store charge ID, payment intent ID, and customer ID
    const charges = paymentIntent.charges?.data || []
    if (charges.length > 0) {
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: {
          stripeChargeId: charges[0].id,
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId: paymentIntent.customer || null,
          paidAt: new Date(),
        },
      })
    }

    // Capture policy acceptance for buyer at checkout
    try {
      const requestMeta = request ? extractRequestMetadata(request) : undefined
      await capturePolicyAcceptance(rift.buyerId, 'checkout', requestMeta)
      
      // Log policy acceptance event
      await logEvent(
        riftId,
        RiftEventActorType.BUYER,
        rift.buyerId,
        'POLICY_ACCEPTED',
        {
          context: 'checkout',
          policy_version: process.env.POLICY_VERSION || '2025-01-17_v1',
        },
        requestMeta
      )
    } catch (error) {
      console.error(`Error capturing policy acceptance for rift ${riftId}:`, error)
      // Don't fail payment if policy acceptance fails
    }

    // Create timeline event
    // Show only the rift value (what the item is worth) - no fee information
    const riftValue = rift.subtotal ?? 0
    
    if (riftValue === 0) {
      console.warn(`Rift ${riftId} has no subtotal set, cannot create accurate timeline event`)
      // Fallback: create a simple message without amounts
      await prisma.timelineEvent.create({
        data: {
          escrowId: riftId,
          type: 'PAYMENT_RECEIVED',
          message: 'Payment confirmed',
        },
      })
    } else {
      // Simple message with just the rift value - no fees
      const message = `Payment received: ${rift.currency} ${riftValue.toFixed(2)}`
      
      await prisma.timelineEvent.create({
        data: {
          escrowId: riftId,
          type: 'PAYMENT_RECEIVED',
          message,
        },
      })
    }

    // Log immutable event for truth engine
    // Extract request metadata if available (webhook may not have full request context)
    const requestMeta = request ? extractRequestMetadata(request) : undefined
    await logEvent(
      riftId,
      'SYSTEM', // Payment webhook is a system event
      null, // No specific actor (system-triggered)
      'PAYMENT_SUCCEEDED',
      {
        paymentIntentId: paymentIntent.id,
        chargeId: charges.length > 0 ? charges[0].id : null,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      requestMeta
    )

    // Apply risk policy after payment success
    try {
      await applyRiskPolicy(riftId)
    } catch (error) {
      console.error(`Error applying risk policy for rift ${riftId}:`, error)
      // Don't fail the webhook if risk policy fails
    }
  }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(paymentIntent: any) {
  const riftId = paymentIntent.metadata?.escrowId
  if (!riftId) return

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      escrowId: riftId,
      type: 'PAYMENT_FAILED',
      message: 'Payment failed',
    },
  })
}

/**
 * Handle chargeback created
 */
async function handleChargebackCreated(dispute: any) {
  const chargeId = dispute.charge
  if (!chargeId) return

  // Find rift by charge ID
  const rift = await prisma.riftTransaction.findFirst({
    where: { stripeChargeId: chargeId },
  })

  if (!rift) {
    console.warn(`Rift not found for chargeback: ${chargeId}`)
    return
  }

  // Debit seller wallet
  const chargebackAmount = dispute.amount / 100 // Convert from cents
  await debitSellerOnChargeback(
    rift.id,
    rift.sellerId,
    chargebackAmount,
    rift.currency,
    {
      disputeId: dispute.id,
      reason: dispute.reason,
    }
  )

  // Update risk metrics for buyer (chargeback)
  try {
    const { updateMetricsOnChargeback } = await import('@/lib/risk/metrics')
    await updateMetricsOnChargeback(rift.buyerId, chargebackAmount)
  } catch (error) {
    console.error(`Error updating chargeback metrics for buyer ${rift.buyerId}:`, error)
  }

  // Create timeline event
  await prisma.timelineEvent.create({
    data: {
      escrowId: rift.id,
      type: 'CHARGEBACK',
      message: `Chargeback created: ${rift.currency} ${chargebackAmount.toFixed(2)}`,
    },
  })

  // Lock seller's future payouts if balance is negative
  const wallet = await prisma.walletAccount.findUnique({
    where: { userId: rift.sellerId },
  })

  if (wallet && wallet.availableBalance < 0) {
    // Mark user for payout lock (could add a flag to user or risk profile)
    console.log(`Seller ${rift.sellerId} has negative balance, payouts should be locked`)
  }
}

/**
 * Handle chargeback closed
 */
async function handleChargebackClosed(dispute: any) {
  // Handle chargeback resolution if needed
  console.log('Chargeback closed:', dispute.id)
}

/**
 * Handle transfer paid (payout completed)
 */
async function handleTransferPaid(transfer: any) {
  const payoutId = transfer.metadata?.payoutId
  if (!payoutId) return

  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'COMPLETED',
      processedAt: new Date(),
      stripeTransferId: transfer.id,
    },
  })
}

/**
 * Handle transfer failed
 */
async function handleTransferFailed(transfer: any) {
  const payoutId = transfer.metadata?.payoutId
  if (!payoutId) return

  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'FAILED',
      failureReason: transfer.failure_message || 'Transfer failed',
    },
  })

  // Refund wallet (payout failed, return funds)
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
  })

  if (payout) {
    await prisma.walletAccount.update({
      where: { userId: payout.userId },
      data: {
        availableBalance: { increment: payout.amount },
      },
    })
  }
}

/**
 * Handle account updated (verification status)
 * Detects status changes and sends notifications
 */
async function handleAccountUpdated(account: any) {
  // Find user by Stripe account ID
  const user = await prisma.user.findFirst({
    where: { stripeConnectAccountId: account.id },
    select: {
      id: true,
      email: true,
      name: true,
      stripeIdentityVerified: true,
    },
  })

  if (!user) {
    console.warn(`User not found for Stripe account: ${account.id}`)
    return
  }

  // Determine current status
  const chargesEnabled = account.charges_enabled || false
  const payoutsEnabled = account.payouts_enabled || false
  const detailsSubmitted = account.details_submitted || false
  const isVerified = chargesEnabled && payoutsEnabled

  // Get previous status from database (stored in a way we can compare)
  const previousVerified = user.stripeIdentityVerified

  // Determine status
  let status: 'approved' | 'pending' | 'restricted' | 'rejected' | 'under_review' = 'pending'
  let statusMessage: string | undefined
  let requirements: string[] = []

  if (chargesEnabled === false || payoutsEnabled === false) {
    if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      status = 'restricted'
      statusMessage = 'Additional information required to enable payouts'
      requirements = account.requirements.currently_due
    } else if (account.requirements?.past_due && account.requirements.past_due.length > 0) {
      status = 'restricted'
      statusMessage = 'Verification information is past due'
      requirements = account.requirements.past_due
    } else if (!detailsSubmitted) {
      status = 'pending'
      statusMessage = 'Complete account setup to enable payouts'
    } else {
      status = 'under_review'
      statusMessage = 'Account is under review by Stripe'
    }
  } else if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
    status = 'approved'
    statusMessage = 'Account approved and ready for payouts'
  } else {
    status = 'pending'
    statusMessage = 'Account setup in progress'
  }

  // Check for disabled/rejected reason
  if ((account as any).disabled_reason) {
    const disabledReason = (account as any).disabled_reason
    if (disabledReason.includes('rejected')) {
      status = 'rejected'
      if (disabledReason.includes('fraud')) {
        statusMessage = 'Account rejected due to fraud concerns'
      } else if (disabledReason.includes('terms')) {
        statusMessage = 'Account rejected for terms of service violation'
      } else {
        statusMessage = 'Account rejected by Stripe'
      }
    }
  }

  // Update user's verification status
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeIdentityVerified: isVerified,
    },
  })

  // Only send notification if status changed (to avoid spam)
  // Check if this is a meaningful status change
  const statusChanged = 
    previousVerified !== isVerified || 
    (isVerified && status === 'approved' && !previousVerified) ||
    status === 'rejected' ||
    status === 'restricted'

  if (statusChanged) {
    // Send email notification
    try {
      await sendStripeStatusChangeEmail(
        user.email,
        user.name,
        status,
        statusMessage,
        requirements.length > 0 ? requirements : undefined
      )
    } catch (error) {
      console.error('Failed to send Stripe status email:', error)
      // Don't fail the webhook if email fails
    }

    // Create activity entry for notification
    try {
      const activitySummary = 
        status === 'approved' ? 'Stripe account approved - you can now receive payouts'
        : status === 'rejected' ? 'Stripe account rejected - please update your information'
        : status === 'restricted' ? 'Stripe account requires additional information'
        : status === 'under_review' ? 'Stripe account under review'
        : 'Stripe account status updated'

      await createActivity(
        user.id,
        'PAYMENT_RECEIVED' as any, // Using existing activity type, could add STRIPE_STATUS_CHANGE
        activitySummary,
        undefined,
        {
          type: 'stripe_status_change',
          status,
          statusMessage,
          accountId: account.id,
        }
      )
    } catch (error) {
      console.error('Failed to create activity entry:', error)
      // Don't fail the webhook if activity creation fails
    }
  }
}
