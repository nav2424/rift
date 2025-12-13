import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { transitionRiftState } from '@/lib/rift-state'
import { debitSellerOnChargeback } from '@/lib/wallet'
import { confirmPaymentIntent } from '@/lib/stripe'

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
        await handlePaymentSucceeded(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any
        await handlePaymentFailed(paymentIntent)
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as any
        await handleChargebackCreated(dispute)
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as any
        await handleChargebackClosed(dispute)
        break
      }

      case 'transfer.paid': {
        const transfer = event.data.object as any
        await handleTransferPaid(transfer)
        break
      }

      case 'transfer.failed': {
        const transfer = event.data.object as any
        await handleTransferFailed(transfer)
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
async function handlePaymentSucceeded(paymentIntent: any) {
  const riftId = paymentIntent.metadata?.escrowId
  if (!riftId) {
    console.warn('Payment intent missing escrowId metadata')
    return
  }

  const rift = await prisma.escrowTransaction.findUnique({
    where: { id: riftId },
  })

  if (!rift) {
    console.warn(`Rift not found: ${riftId}`)
    return
  }

  // Only transition if still in DRAFT
  if (rift.status === 'DRAFT') {
    await transitionRiftState(rift.id, 'FUNDED')
    
    // Store charge ID
    const charges = paymentIntent.charges?.data || []
    if (charges.length > 0) {
      await prisma.escrowTransaction.update({
        where: { id: riftId },
        data: {
          stripeChargeId: charges[0].id,
        },
      })
    }

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: riftId,
        type: 'PAYMENT_RECEIVED',
        message: `Payment confirmed: ${rift.currency} ${paymentIntent.amount / 100}`,
      },
    })
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
  const rift = await prisma.escrowTransaction.findFirst({
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
 */
async function handleAccountUpdated(account: any) {
  // Update user's Stripe verification status
  const user = await prisma.user.findFirst({
    where: { stripeConnectAccountId: account.id },
  })

  if (user) {
    const isVerified = account.charges_enabled && account.payouts_enabled
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeIdentityVerified: isVerified,
      },
    })
  }
}
