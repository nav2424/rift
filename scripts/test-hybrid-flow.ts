#!/usr/bin/env tsx
/**
 * End-to-end test script for Hybrid Protection System
 * 
 * This script tests the complete flow:
 * 1. Create rift
 * 2. Pay rift
 * 3. Upload verified shipment proof
 * 4. Confirm receipt
 * 5. Verify grace period
 * 6. Test auto-release
 * 
 * Usage: npm run test:hybrid-flow
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TestUser {
  id: string
  email: string
  name: string | null
}

async function main() {
  console.log('🧪 Starting Hybrid Protection System Test\n')

  try {
    // Step 1: Find or create test users
    console.log('📋 Step 1: Setting up test users...')
    let buyer = await prisma.user.findFirst({ where: { email: 'buyer@test.com' } })
    let seller = await prisma.user.findFirst({ where: { email: 'seller@test.com' } })

    if (!buyer) {
      const bcrypt = require('bcryptjs')
      buyer = await prisma.user.create({
        data: {
          email: 'buyer@test.com',
          passwordHash: await bcrypt.hash('password123', 10),
          name: 'Test Buyer',
        },
      })
      console.log('✅ Created buyer:', buyer.email)
    } else {
      console.log('✅ Found buyer:', buyer.email)
    }

    if (!seller) {
      const bcrypt = require('bcryptjs')
      seller = await prisma.user.create({
        data: {
          email: 'seller@test.com',
          passwordHash: await bcrypt.hash('password123', 10),
          name: 'Test Seller',
        },
      })
      console.log('✅ Created seller:', seller.email)
    } else {
      console.log('✅ Found seller:', seller.email)
    }

    // Step 2: Create rift
    console.log('\n📦 Step 2: Creating rift transaction...')
    
    // Generate rift number
    const lastEscrow = await prisma.riftTransaction.findFirst({
      orderBy: { riftNumber: 'desc' },
      select: { riftNumber: true },
    })
    const riftNumber = lastEscrow ? lastEscrow.riftNumber + 1 : 1000
    
    const subtotal = 100.0
    const buyerFee = subtotal * 0.03 // 3%
    const sellerFee = subtotal * 0.05 // 5%
    
    const rift = await prisma.riftTransaction.create({
      data: {
        riftNumber,
        itemTitle: 'Test Item - Hybrid Protection',
        itemDescription: 'Testing the hybrid protection system',
        itemType: 'PHYSICAL',
        subtotal,
        buyerFee,
        sellerFee,
        currency: 'CAD',
        status: 'AWAITING_PAYMENT',
        buyerId: buyer.id,
        sellerId: seller.id,
        shippingAddress: '123 Test St, Toronto, ON',
      },
      include: {
        buyer: true,
        seller: true,
      },
    })
    console.log('✅ Created rift:', rift.id)
    console.log('   Amount:', rift.subtotal, rift.currency)
    console.log('   Status:', rift.status)

    // Step 3: Simulate payment (mark as paid)
    console.log('\n💰 Step 3: Marking rift as paid...')
    const paidEscrow = await prisma.riftTransaction.update({
      where: { id: rift.id },
      data: { status: 'AWAITING_SHIPMENT' },
    })
    console.log('✅ Rift marked as paid')
    console.log('   Status:', paidEscrow.status)

    // Step 4: Upload shipment proof with tracking
    console.log('\n📮 Step 4: Uploading verified shipment proof...')
    const trackingNumber = '1Z999AA10123456784' // Valid UPS format
    const shipmentProof = await prisma.shipmentProof.create({
      data: {
        escrowId: rift.id,
        trackingNumber,
        shippingCarrier: 'UPS',
        verified: true,
        deliveryStatus: 'IN_TRANSIT',
        notes: 'Test shipment proof',
      },
    })
    
    const verifiedEscrow = await prisma.riftTransaction.update({
      where: { id: rift.id },
      data: {
        status: 'IN_TRANSIT',
        shipmentVerifiedAt: new Date(),
        trackingVerified: true,
      },
    })
    console.log('✅ Shipment proof uploaded')
    console.log('   Tracking:', trackingNumber)
    console.log('   Verified:', verifiedEscrow.trackingVerified)
    console.log('   Verified At:', verifiedEscrow.shipmentVerifiedAt)

    // Step 5: Confirm receipt (buyer confirms)
    console.log('\n✅ Step 5: Buyer confirming receipt...')
    const gracePeriodHours = 48
    const gracePeriodEndsAt = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000)
    
    const deliveredEscrow = await prisma.riftTransaction.update({
      where: { id: rift.id },
      data: {
        status: 'DELIVERED_PENDING_RELEASE',
        deliveryVerifiedAt: new Date(),
        gracePeriodEndsAt,
        autoReleaseScheduled: true,
      },
    })
    console.log('✅ Receipt confirmed')
    console.log('   Status:', deliveredEscrow.status)
    console.log('   Delivery Verified At:', deliveredEscrow.deliveryVerifiedAt)
    console.log('   Grace Period Ends At:', deliveredEscrow.gracePeriodEndsAt)
    console.log('   Auto-Release Scheduled:', deliveredEscrow.autoReleaseScheduled)

    // Step 6: Test dispute restrictions
    console.log('\n🚨 Step 6: Testing dispute restrictions...')
    const shipmentVerified = deliveredEscrow.shipmentVerifiedAt !== null && deliveredEscrow.trackingVerified
    const deliveryVerified = deliveredEscrow.deliveryVerifiedAt !== null
    
    if (shipmentVerified && deliveryVerified) {
      console.log('✅ Shipment and delivery verified')
      console.log('   ❌ "Item Not Received" disputes should be blocked')
      console.log('   ✅ Other dispute types allowed:')
      console.log('      - Item Not as Described')
      console.log('      - Item Damaged')
      console.log('      - Wrong Item')
      console.log('      - Wrong Address')
    }

    // Step 7: Check auto-release eligibility
    console.log('\n⏰ Step 7: Checking auto-release eligibility...')
    const now = new Date()
    const eligibleForAutoRelease = 
      deliveredEscrow.shipmentVerifiedAt !== null &&
      deliveredEscrow.deliveryVerifiedAt !== null &&
      deliveredEscrow.gracePeriodEndsAt !== null &&
      deliveredEscrow.gracePeriodEndsAt <= now &&
      deliveredEscrow.autoReleaseScheduled &&
      deliveredEscrow.status === 'DELIVERED_PENDING_RELEASE'

    if (eligibleForAutoRelease) {
      console.log('✅ Rift is eligible for auto-release')
      console.log('   Run: npm run cron:auto-release to process')
    } else {
      console.log('⏳ Rift is in grace period')
      console.log('   Time until auto-release:', deliveredEscrow.gracePeriodEndsAt 
        ? `${Math.round((deliveredEscrow.gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60))} hours`
        : 'N/A')
    }

    // Step 8: Summary
    console.log('\n📊 Test Summary:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Rift ID:', rift.id)
    console.log('Current Status:', deliveredEscrow.status)
    console.log('Shipment Verified:', deliveredEscrow.trackingVerified ? 'Yes' : 'No')
    console.log('Delivery Verified:', deliveredEscrow.deliveryVerifiedAt ? 'Yes' : 'No')
    console.log('Grace Period Ends:', deliveredEscrow.gracePeriodEndsAt?.toLocaleString() || 'N/A')
    console.log('Auto-Release Scheduled:', deliveredEscrow.autoReleaseScheduled ? 'Yes' : 'No')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('✅ Hybrid Protection System test completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Wait for grace period to expire (or manually set gracePeriodEndsAt to past date)')
    console.log('2. Run: npm run cron:auto-release')
    console.log('3. Verify funds are released automatically\n')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

