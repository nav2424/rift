/**
 * Manually fix a specific rift payment by providing the payment intent ID
 * Usage: npx tsx scripts/manual-fix-payment.ts <riftId> <paymentIntentId>
 * Or: npx tsx scripts/manual-fix-payment.ts <paymentIntentId> (will find matching rift)
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npx tsx scripts/manual-fix-payment.ts <riftId> <paymentIntentId>')
    console.log('  npx tsx scripts/manual-fix-payment.ts <paymentIntentId>')
    console.log('')
    console.log('Example:')
    console.log('  npx tsx scripts/manual-fix-payment.ts pi_1234567890')
    console.log('  npx tsx scripts/manual-fix-payment.ts ec4cccef-1c16-489a-96f2-2b0cf2300abd pi_1234567890')
    process.exit(1)
  }

  if (!stripe) {
    console.error('❌ Stripe is not configured. Set STRIPE_SECRET_KEY.')
    process.exit(1)
  }

  let riftId: string | undefined
  let paymentIntentId: string

  if (args.length === 1) {
    // Only payment intent ID provided - find matching rift
    paymentIntentId = args[0]
    console.log(`🔍 Looking up payment intent: ${paymentIntentId}\n`)
  } else {
    // Both rift ID and payment intent ID provided
    riftId = args[0]
    paymentIntentId = args[1]
    console.log(`🔍 Fixing rift ${riftId} with payment intent ${paymentIntentId}\n`)
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    console.log(`✅ Found payment intent in Stripe:`)
    console.log(`   Status: ${paymentIntent.status}`)
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`)
    console.log(`   Created: ${new Date(paymentIntent.created * 1000).toISOString()}`)
    console.log(`   Receipt Email: ${paymentIntent.receipt_email || 'N/A'}`)
    console.log(`   Metadata escrowId: ${paymentIntent.metadata?.escrowId || 'N/A'}\n`)

    if (paymentIntent.status !== 'succeeded') {
      console.error(`❌ Payment intent status is ${paymentIntent.status}, not succeeded.`)
      console.error('   Cannot fix a rift for a payment that hasn\'t succeeded.')
      process.exit(1)
    }

    // Find the rift
    if (!riftId) {
      // Try to find rift from metadata
      riftId = paymentIntent.metadata?.escrowId

      if (!riftId) {
        console.error('❌ Cannot find rift ID. Payment intent metadata is missing escrowId.')
        console.error('   Please provide the rift ID as the first argument.')
        process.exit(1)
      }

      console.log(`📋 Found rift ID from metadata: ${riftId}\n`)
    }

    // Get the rift
    const riftRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id,
        "riftNumber",
        "itemTitle",
        amount,
        currency,
        status,
        "buyerId",
        "sellerId",
        "stripePaymentIntentId",
        "createdAt"
      FROM "EscrowTransaction"
      WHERE id = $1
    `, riftId)

    if (riftRaw.length === 0) {
      console.error(`❌ Rift not found: ${riftId}`)
      process.exit(1)
    }

    const rift = riftRaw[0]

    console.log(`📋 Rift #${rift.riftNumber}:`)
    console.log(`   Title: ${rift.itemTitle}`)
    console.log(`   Amount: ${rift.currency} ${rift.amount}`)
    console.log(`   Status: ${rift.status}`)
    console.log(`   Stored Payment Intent: ${rift.stripePaymentIntentId || 'NONE'}\n`)

    if (rift.status !== 'AWAITING_PAYMENT') {
      console.log(`⚠️  Rift is in ${rift.status} status, not AWAITING_PAYMENT.`)
      console.log(`   Do you still want to update the payment intent ID? (yes/no)`)
      // For automated scripts, we'll proceed anyway
    }

    // Verify amounts match (approximately - payment intent includes fees)
    const riftAmountCents = Math.round(parseFloat(rift.amount || '0') * 100)
    const metadataAmount = paymentIntent.metadata?.subtotal 
      ? Math.round(parseFloat(paymentIntent.metadata.subtotal) * 100)
      : null

    if (metadataAmount && Math.abs(metadataAmount - riftAmountCents) > 1) {
      console.warn(`⚠️  Amount mismatch:`)
      console.warn(`   Rift amount: ${riftAmountCents} cents`)
      console.warn(`   Payment metadata amount: ${metadataAmount} cents`)
      console.warn(`   Proceeding anyway...\n`)
    }

    console.log('🔧 Fixing rift...\n')

    // Store payment info
    const charges = paymentIntent.charges?.data || []
    const updateData: any = {
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: paymentIntent.customer || null,
      paidAt: new Date(paymentIntent.created * 1000),
    }

    if (charges.length > 0) {
      updateData.stripeChargeId = charges[0].id
    }

    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: updateData,
    })

    console.log('✅ Payment info stored')

    // Transition to FUNDED if still in AWAITING_PAYMENT
    if (rift.status === 'AWAITING_PAYMENT') {
      const { transitionRiftState } = await import('../lib/rift-state')
      await transitionRiftState(riftId, 'FUNDED')
      console.log('✅ Status updated to FUNDED')
    } else {
      console.log(`⚠️  Status remains ${rift.status} (not AWAITING_PAYMENT, so no transition)`)
    }

    console.log('\n✅ Rift payment fixed successfully!')
  } catch (error: any) {
    if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
      console.error(`❌ Payment intent not found: ${paymentIntentId}`)
      console.error('   Make sure you\'re using the correct Stripe mode (test vs live)')
      console.error(`   Current mode: ${process.env.STRIPE_SECRET_KEY?.includes('_live_') ? 'LIVE' : 'TEST'}`)
    } else {
      console.error('❌ Error:', error.message)
      if (error.stack && process.env.NODE_ENV === 'development') {
        console.error(error.stack)
      }
    }
    process.exit(1)
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
