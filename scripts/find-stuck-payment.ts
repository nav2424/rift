/**
 * Find a specific payment or check all rifts in AWAITING_PAYMENT
 * This helps identify rifts that need payment confirmation
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' as any })
  : null

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.')
    process.exit(1)
  }

  console.log('🔍 Checking for rifts in AWAITING_PAYMENT status...\n')

  // Find ALL rifts in AWAITING_PAYMENT (with or without payment intent)
  const awaitingPaymentRifts = await prisma.riftTransaction.findMany({
    where: {
      status: 'AWAITING_PAYMENT',
    },
    select: {
      id: true,
      riftNumber: true,
      itemTitle: true,
      amount: true,
      currency: true,
      stripePaymentIntentId: true,
      createdAt: true,
      buyerId: true,
      sellerId: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  })

  console.log(`Found ${awaitingPaymentRifts.length} rift(s) in AWAITING_PAYMENT status:\n`)

  if (awaitingPaymentRifts.length === 0) {
    console.log('✅ No rifts found in AWAITING_PAYMENT status.')
    console.log('This might mean:')
    console.log('  1. All payments have been processed')
    console.log('  2. The rift status was already updated')
    console.log('  3. The rift ID you\'re looking for doesn\'t exist\n')
    
    // Check recent rifts
    console.log('Checking recent rifts (last 10)...\n')
    const recentRifts = await prisma.riftTransaction.findMany({
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        status: true,
        amount: true,
        stripePaymentIntentId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    recentRifts.forEach(rift => {
      console.log(`  Rift #${rift.riftNumber}: ${rift.status} - ${rift.itemTitle}`)
      if (rift.stripePaymentIntentId) {
        console.log(`    Payment Intent: ${rift.stripePaymentIntentId}`)
      }
    })
    return
  }

  // Check each rift
  for (const rift of awaitingPaymentRifts) {
    console.log(`\n📋 Rift #${rift.riftNumber} (${rift.id}):`)
    console.log(`   Title: ${rift.itemTitle}`)
    console.log(`   Amount: ${rift.currency} ${rift.amount}`)
    console.log(`   Created: ${rift.createdAt.toISOString()}`)
    console.log(`   Payment Intent ID: ${rift.stripePaymentIntentId || 'NOT STORED ❌'}`)

    // If payment intent ID exists, check Stripe
    if (rift.stripePaymentIntentId && stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(rift.stripePaymentIntentId)
        console.log(`   Stripe Status: ${paymentIntent.status}`)
        
        if (paymentIntent.status === 'succeeded') {
          console.log(`   ⚠️  PAYMENT SUCCEEDED BUT RIFT STATUS NOT UPDATED!`)
          console.log(`   This rift needs to be fixed.`)
        } else if (paymentIntent.status === 'processing') {
          console.log(`   ⏳ Payment is still processing (will be updated by webhook)`)
        } else {
          console.log(`   ℹ️  Payment status: ${paymentIntent.status}`)
        }
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.log(`   ⚠️  Payment intent not found in Stripe (might be test/mock)`)
        } else {
          console.log(`   ❌ Error checking Stripe: ${error.message}`)
        }
      }
    } else if (!rift.stripePaymentIntentId) {
      console.log(`   ⚠️  No payment intent ID stored - payment might have been processed`)
      console.log(`   You may need to manually find the payment intent ID from Stripe Dashboard`)
    }
  }

  console.log(`\n💡 To fix a specific rift, run:`)
  console.log(`   npx tsx scripts/fix-stuck-payments.ts`)
  console.log(`\n   Or manually update via API:`)
  console.log(`   PUT /api/rifts/{riftId}/fund with paymentIntentId`)
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
