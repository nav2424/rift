/**
 * Find payment intents in Stripe that match rifts stuck in AWAITING_PAYMENT
 * This script searches Stripe for recent successful payments and matches them to rifts
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
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' as any })
  : null

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.')
    process.exit(1)
  }

  if (!stripe) {
    console.error('❌ Stripe is not configured. Set STRIPE_SECRET_KEY.')
    process.exit(1)
  }

  console.log('🔍 Finding rifts stuck in AWAITING_PAYMENT without payment intent IDs...\n')

  // Find rifts in AWAITING_PAYMENT without payment intent IDs
  // Use raw SQL to avoid enum deserialization issues
  const stuckRiftsRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      e.id,
      e."riftNumber",
      e."itemTitle",
      e.amount,
      e.currency,
      e."createdAt",
      e."buyerId",
      e."sellerId",
      u.email as buyer_email
    FROM "EscrowTransaction" e
    JOIN "User" u ON e."buyerId" = u.id
    WHERE e.status::text = 'AWAITING_PAYMENT'
      AND e."stripePaymentIntentId" IS NULL
    ORDER BY e."createdAt" DESC
    LIMIT 20
  `)

  const stuckRifts = stuckRiftsRaw.map(r => ({
    id: r.id,
    riftNumber: r.riftNumber,
    itemTitle: r.itemTitle,
    amount: parseFloat(r.amount || '0'),
    currency: r.currency,
    createdAt: new Date(r.createdAt),
    buyerId: r.buyerId,
    sellerId: r.sellerId,
    buyer: {
      email: r.buyer_email,
    },
  }))

  if (stuckRifts.length === 0) {
    console.log('✅ No rifts found without payment intent IDs.')
    return
  }

  console.log(`Found ${stuckRifts.length} rift(s) without payment intent IDs.\n`)
  console.log('🔍 Searching Stripe for matching payment intents...\n')

  // Search Stripe for recent payment intents (last 7 days to catch all recent payments)
  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
  
  try {
    // Get all payment intents from last 7 days
    let allPaymentIntents: Stripe.PaymentIntent[] = []
    let hasMore = true
    let startingAfter: string | undefined = undefined

    while (hasMore && allPaymentIntents.length < 500) {
      const response: Stripe.Response<Stripe.ApiList<Stripe.PaymentIntent>> = await stripe.paymentIntents.list({
        limit: 100,
        created: { gte: sevenDaysAgo },
        ...(startingAfter && { starting_after: startingAfter }),
      })

      allPaymentIntents.push(...response.data)
      hasMore = response.has_more
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id
      }
    }

    const paymentIntents = { data: allPaymentIntents }

    console.log(`Found ${paymentIntents.data.length} payment intent(s) in Stripe from last 7 days.`)
    console.log(`Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.includes('_live_') ? 'LIVE' : 'TEST'}\n`)
    
    if (paymentIntents.data.length === 0) {
      console.log('⚠️  No payment intents found. This could mean:')
      console.log('   1. Payments were made in a different Stripe mode (test vs live)')
      console.log('   2. Payments are older than 7 days')
      console.log('   3. The STRIPE_SECRET_KEY might be incorrect')
      console.log('\n💡 Try searching manually in Stripe Dashboard:')
      console.log('   - Check both Test and Live modes')
      console.log('   - Look for payments to: arnav.saluja@icloud.com or saluja.arnav04@gmail.com')
      console.log('   - Find the payment intent ID and use it to manually fix the rift\n')
      return
    }

    let matched = 0
    let fixed = 0

    // Try to match payment intents to rifts
    for (const rift of stuckRifts) {
      console.log(`\n📋 Checking Rift #${rift.riftNumber} (${rift.id}):`)
      console.log(`   Amount: ${rift.currency} ${rift.amount}`)
      console.log(`   Buyer: ${rift.buyer.email}`)
      console.log(`   Created: ${rift.createdAt.toISOString()}`)

      // Look for payment intents that might match
      const possibleMatches = paymentIntents.data.filter(pi => {
        // Match by metadata escrowId if present
        if (pi.metadata?.escrowId === rift.id) {
          return true
        }

        // Match by amount (convert to cents)
        const amountCents = Math.round((rift.amount || 0) * 100)
        // Note: Payment intent amount includes fees, so we need to check metadata
        const metadataAmount = pi.metadata?.subtotal ? parseFloat(pi.metadata.subtotal) * 100 : null
        if (metadataAmount && Math.abs(metadataAmount - amountCents) < 1) {
          return true
        }

        // Match by email and approximate time (within 1 hour)
        const riftTime = Math.floor(rift.createdAt.getTime() / 1000)
        const timeDiff = Math.abs(pi.created - riftTime)
        if (timeDiff < 3600 && pi.receipt_email === rift.buyer.email) {
          return true
        }

        return false
      })

      if (possibleMatches.length === 0) {
        console.log(`   ❌ No matching payment intent found in Stripe`)
        continue
      }

      // Find the one that succeeded
      const succeededPayment = possibleMatches.find(pi => pi.status === 'succeeded')
      if (!succeededPayment) {
        console.log(`   ⚠️  Found ${possibleMatches.length} possible match(es) but none succeeded yet`)
        possibleMatches.forEach(pi => {
          console.log(`      - ${pi.id}: ${pi.status} (created: ${new Date(pi.created * 1000).toISOString()})`)
        })
        continue
      }

      console.log(`   ✅ Found matching succeeded payment: ${succeededPayment.id}`)
      matched++

      // Verify the payment intent belongs to this rift
      const paymentRiftId = succeededPayment.metadata?.escrowId
      if (paymentRiftId && paymentRiftId !== rift.id) {
        console.log(`   ⚠️  Payment intent belongs to different rift (${paymentRiftId}), skipping`)
        continue
      }

      // Ask for confirmation or auto-fix
      console.log(`   🔧 Fixing rift...`)

      try {
        // Store payment intent ID
        const charges = succeededPayment.charges?.data || []
        const updateData: any = {
          stripePaymentIntentId: succeededPayment.id,
          stripeCustomerId: succeededPayment.customer || null,
          paidAt: new Date(succeededPayment.created * 1000),
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

        console.log(`   ✅ Fixed! Status updated to FUNDED`)
        fixed++
      } catch (error: any) {
        console.error(`   ❌ Error fixing rift:`, error.message)
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Matched: ${matched}`)
    console.log(`   ✅ Fixed: ${fixed}`)
    console.log(`   ⚠️  Not matched: ${stuckRifts.length - matched}`)

    if (fixed === 0 && matched > 0) {
      console.log(`\n⚠️  Found matches but couldn't fix them. Check the errors above.`)
    } else if (fixed > 0) {
      console.log(`\n✅ Successfully fixed ${fixed} rift(s)!`)
    }
  } catch (error: any) {
    console.error('❌ Error searching Stripe:', error.message)
    if (error.type === 'StripeAuthenticationError') {
      console.error('   Check your STRIPE_SECRET_KEY is correct')
    }
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
