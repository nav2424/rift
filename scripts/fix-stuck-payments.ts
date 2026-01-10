/**
 * Fix rifts that are stuck in AWAITING_PAYMENT but have succeeded payments
 * This script checks Stripe for payment status and updates rifts accordingly
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'

// Try loading .env.local first, fallback to .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null

async function main() {
  // Check environment variables
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.')
    console.error('Please either:')
    console.error('  1. Set DATABASE_URL environment variable: export DATABASE_URL="..."')
    console.error('  2. Or ensure .env.local contains DATABASE_URL')
    console.error('')
    console.error('Get your DATABASE_URL from:')
    console.error('  - Supabase Dashboard → Settings → Database → Connection string (URI)')
    console.error('  - Or pull from Vercel: vercel env pull .env.production')
    process.exit(1)
  }

  if (!stripe) {
    console.error('❌ Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.')
    console.error('Get your STRIPE_SECRET_KEY from Stripe Dashboard or Vercel environment variables.')
    process.exit(1)
  }

  console.log('✅ Environment variables loaded')
  console.log(`   Database: ${process.env.DATABASE_URL.substring(0, 50)}...`)
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY?.substring(0, 20)}...`)
  console.log('')
  console.log('🔍 Finding rifts stuck in AWAITING_PAYMENT with payment intent IDs...')

  // Find rifts in AWAITING_PAYMENT with payment intent IDs
  const stuckRifts = await prisma.riftTransaction.findMany({
    where: {
      status: 'AWAITING_PAYMENT',
      stripePaymentIntentId: { not: null },
    },
    select: {
      id: true,
      riftNumber: true,
      stripePaymentIntentId: true,
      createdAt: true,
    },
    take: 100, // Process in batches
  })

  console.log(`Found ${stuckRifts.length} rifts to check\n`)

  let fixed = 0
  let failed = 0
  let skipped = 0

  for (const rift of stuckRifts) {
    if (!rift.stripePaymentIntentId) {
      skipped++
      continue
    }

    try {
      console.log(`Checking Rift #${rift.riftNumber} (${rift.id})...`)
      
      // Check payment intent status in Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(rift.stripePaymentIntentId)

      if (paymentIntent.status === 'succeeded') {
        console.log(`  ✅ Payment succeeded! Updating status...`)

        // Verify this payment intent belongs to this rift
        const paymentRiftId = paymentIntent.metadata?.escrowId
        if (paymentRiftId && paymentRiftId !== rift.id) {
          console.log(`  ⚠️  Payment intent belongs to different rift (${paymentRiftId}), skipping`)
          skipped++
          continue
        }

        // Update payment info
        const charges = paymentIntent.charges?.data || []
        const updateData: any = {
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId: paymentIntent.customer || null,
          paidAt: new Date(),
        }

        if (charges.length > 0) {
          updateData.stripeChargeId = charges[0].id
        }

        await prisma.riftTransaction.update({
          where: { id: rift.id },
          data: updateData,
        })

        // Transition to FUNDED
        const { transitionRiftState } = await import('../lib/rift-state')
        await transitionRiftState(rift.id, 'FUNDED')

        console.log(`  ✅ Fixed! Status updated to FUNDED\n`)
        fixed++
      } else if (paymentIntent.status === 'processing') {
        console.log(`  ⏳ Payment is still processing, will be handled by webhook\n`)
        skipped++
      } else {
        console.log(`  ⚠️  Payment status: ${paymentIntent.status}, skipping\n`)
        skipped++
      }
    } catch (error: any) {
      console.error(`  ❌ Error checking rift ${rift.id}:`, error.message)
      
      if (error.code === 'resource_missing') {
        console.log(`  ⚠️  Payment intent not found in Stripe, might be a test/mock payment\n`)
        skipped++
      } else {
        failed++
      }
    }
  }

  console.log('\n📊 Summary:')
  console.log(`  ✅ Fixed: ${fixed}`)
  console.log(`  ⚠️  Skipped: ${skipped}`)
  console.log(`  ❌ Failed: ${failed}`)

  if (fixed > 0) {
    console.log(`\n✅ Successfully fixed ${fixed} rift(s)!`)
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
