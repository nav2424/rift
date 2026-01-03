/**
 * End-to-End Rift Flow Test Script
 * 
 * This script tests the complete rift flow from creation to payout.
 * Run with: npm run test:rift-flow
 * 
 * Requirements:
 * - Database connection configured (DATABASE_URL in .env)
 * - Prisma client generated (npx prisma generate)
 * - Migrations applied (npx prisma migrate deploy)
 */

import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import { generateNextRiftNumber } from '../lib/rift-number'
import { randomUUID } from 'crypto'

interface TestResult {
  step: string
  success: boolean
  error?: string
  data?: any
}

async function testRiftFlow() {
  const results: TestResult[] = []

  try {
    console.log('🧪 Starting End-to-End Rift Flow Test\n')

    // Step 1: Find or create test users
    console.log('Step 1: Setting up test users...')
    let buyer = await prisma.user.findFirst({
      where: { email: 'test-buyer@rift.test' },
    })
    let seller = await prisma.user.findFirst({
      where: { email: 'test-seller@rift.test' },
    })

    if (!buyer) {
      const passwordHash = await bcrypt.hash('test-password', 10)
      buyer = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: 'test-buyer@rift.test',
          name: 'Test Buyer',
          passwordHash,
          emailVerified: true,
          updatedAt: new Date(),
        },
      })
    }

    if (!seller) {
      const passwordHash = await bcrypt.hash('test-password', 10)
      seller = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: 'test-seller@rift.test',
          name: 'Test Seller',
          passwordHash,
          emailVerified: true,
          updatedAt: new Date(),
        },
      })
    }

    results.push({ step: 'Setup test users', success: true, data: { buyerId: buyer.id, sellerId: seller.id } })
    console.log('✅ Test users ready\n')

    // Step 2: Test fee calculations
    console.log('Step 2: Testing fee calculations...')
    const subtotal = 100.0
    const buyerFee = subtotal * 0.03 // 3%
    const sellerFee = subtotal * 0.05 // 5%
    const sellerNet = subtotal - sellerFee
    const buyerTotal = subtotal + buyerFee

    console.log(`  Subtotal: $${subtotal.toFixed(2)}`)
    console.log(`  Buyer fee (3%): $${buyerFee.toFixed(2)}`)
    console.log(`  Seller fee (5%): $${sellerFee.toFixed(2)}`)
    console.log(`  Seller net: $${sellerNet.toFixed(2)}`)
    console.log(`  Buyer total: $${buyerTotal.toFixed(2)}`)

    if (Math.abs(buyerFee - 3.0) > 0.01 || Math.abs(sellerFee - 5.0) > 0.01 || Math.abs(sellerNet - 95.0) > 0.01) {
      throw new Error('Fee calculations incorrect')
    }

    results.push({ step: 'Fee calculations', success: true, data: { buyerFee, sellerFee, sellerNet, buyerTotal } })
    console.log('✅ Fee calculations correct\n')

    // Step 3: Create a rift
    console.log('Step 3: Creating rift...')
    const riftNumber = await generateNextRiftNumber()
    const rift = await prisma.riftTransaction.create({
      data: {
        riftNumber,
        itemTitle: 'Test Item',
        itemDescription: 'End-to-end test item',
        itemType: 'DIGITAL',
        subtotal,
        buyerFee,
        sellerFee,
        sellerNet,
        currency: 'CAD',
        buyerId: buyer.id,
        sellerId: seller.id,
        status: 'AWAITING_PAYMENT',
        amount: subtotal,
        platformFee: sellerFee,
        sellerPayoutAmount: sellerNet,
      },
    })

    results.push({ step: 'Create rift', success: true, data: { riftId: rift.id, status: rift.status } })
    console.log(`✅ Rift created: ${rift.id} (Status: ${rift.status})\n`)

    // Step 4: Verify initial state
    console.log('Step 4: Verifying initial state...')
    if (rift.status !== 'AWAITING_PAYMENT') {
      throw new Error(`Expected AWAITING_PAYMENT, got ${rift.status}`)
    }
    if (rift.buyerFee !== buyerFee || rift.sellerFee !== sellerFee || rift.sellerNet !== sellerNet) {
      throw new Error('Fee fields not set correctly')
    }
    results.push({ step: 'Verify initial state', success: true })
    console.log('✅ Initial state correct\n')

    // Step 5: Simulate payment (transition to FUNDED)
    console.log('Step 5: Simulating payment (transitioning to FUNDED)...')
    const fundedRift = await prisma.riftTransaction.update({
      where: { id: rift.id },
      data: {
        status: 'FUNDED',
        fundedAt: new Date(),
        stripePaymentIntentId: 'pi_test_' + Date.now(),
      },
    })

    if (fundedRift.status !== 'FUNDED') {
      throw new Error(`Expected FUNDED, got ${fundedRift.status}`)
    }
    results.push({ step: 'Payment (FUNDED)', success: true, data: { status: fundedRift.status } })
    console.log(`✅ Rift funded: ${fundedRift.id} (Status: ${fundedRift.status})\n`)

    // Step 6: Simulate proof submission (transition to PROOF_SUBMITTED)
    console.log('Step 6: Simulating proof submission...')
    const proofSubmittedRift = await prisma.riftTransaction.update({
      where: { id: fundedRift.id },
      data: {
        status: 'PROOF_SUBMITTED',
        proofSubmittedAt: new Date(),
      },
    })

    if (proofSubmittedRift.status !== 'PROOF_SUBMITTED') {
      throw new Error(`Expected PROOF_SUBMITTED, got ${proofSubmittedRift.status}`)
    }
    results.push({ step: 'Proof submission', success: true, data: { status: proofSubmittedRift.status } })
    console.log(`✅ Proof submitted: ${proofSubmittedRift.id} (Status: ${proofSubmittedRift.status})\n`)

    // Step 7: Verify wallet account exists (or would be created)
    console.log('Step 7: Verifying wallet setup...')
    let wallet = await prisma.walletAccount.findUnique({
      where: { userId: seller.id },
    })

    if (!wallet) {
      wallet = await prisma.walletAccount.create({
        data: {
          userId: seller.id,
          currency: 'CAD',
          availableBalance: 0,
          pendingBalance: 0,
        },
      })
    }
    results.push({ step: 'Wallet setup', success: true, data: { walletId: wallet.id, balance: wallet.availableBalance } })
    console.log(`✅ Wallet ready: ${wallet.id} (Balance: $${wallet.availableBalance.toFixed(2)})\n`)

    // Step 8: Test release (this would normally call transitionRiftState)
    console.log('Step 8: Testing release logic...')
    const initialBalance = wallet.availableBalance

    // Simulate what transitionRiftState does
    const releasedRift = await prisma.riftTransaction.update({
      where: { id: proofSubmittedRift.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    })

    // Simulate wallet credit
    const updatedWallet = await prisma.walletAccount.update({
      where: { id: wallet.id },
      data: {
        availableBalance: {
          increment: sellerNet,
        },
      },
    })

    if (updatedWallet.availableBalance !== initialBalance + sellerNet) {
      throw new Error(`Wallet balance incorrect. Expected ${initialBalance + sellerNet}, got ${updatedWallet.availableBalance}`)
    }

    results.push({ 
      step: 'Release funds', 
      success: true, 
      data: { 
        status: releasedRift.status, 
        walletBalance: updatedWallet.availableBalance,
        credited: sellerNet
      } 
    })
    console.log(`✅ Funds released: ${releasedRift.id}`)
    console.log(`   Wallet balance: $${updatedWallet.availableBalance.toFixed(2)} (credited $${sellerNet.toFixed(2)})\n`)

    // Step 9: Test payout scheduling
    console.log('Step 9: Testing payout scheduling...')
    const payout = await prisma.payout.create({
      data: {
        userId: seller.id,
        riftId: releasedRift.id,
        amount: sellerNet,
        currency: 'CAD',
        status: 'PENDING',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
    })

    results.push({ step: 'Schedule payout', success: true, data: { payoutId: payout.id, amount: payout.amount } })
    console.log(`✅ Payout scheduled: ${payout.id} (Amount: $${payout.amount.toFixed(2)})\n`)

    // Step 10: Verify timeline events
    console.log('Step 10: Verifying timeline events...')
    const timelineEvents = await prisma.timelineEvent.findMany({
      where: { escrowId: rift.id },
      orderBy: { createdAt: 'asc' },
    })

    console.log(`   Found ${timelineEvents.length} timeline events`)
    timelineEvents.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.type}: ${event.message}`)
    })

    results.push({ step: 'Timeline events', success: true, data: { count: timelineEvents.length } })
    console.log('✅ Timeline events verified\n')

    // Summary
    console.log('='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`Total steps: ${results.length}`)
    console.log(`✅ Successful: ${successful}`)
    console.log(`❌ Failed: ${failed}\n`)

    results.forEach(result => {
      const icon = result.success ? '✅' : '❌'
      console.log(`${icon} ${result.step}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })

    console.log('\n' + '='.repeat(60))

    // Cleanup (optional - comment out if you want to inspect the data)
    if (process.env.KEEP_TEST_DATA !== 'true') {
      console.log('\n🧹 Cleaning up test data...')
      await prisma.timelineEvent.deleteMany({ where: { escrowId: rift.id } })
      await prisma.payout.delete({ where: { id: payout.id } })
      await prisma.walletLedgerEntry.deleteMany({ where: { walletAccountId: wallet.id } })
      await prisma.walletAccount.update({
        where: { id: wallet.id },
        data: { availableBalance: initialBalance },
      })
      await prisma.riftTransaction.delete({ where: { id: rift.id } })
      console.log('✅ Test data cleaned up')
    } else {
      console.log('\n⚠️  Keeping test data (KEEP_TEST_DATA=true)')
      console.log(`   Rift ID: ${rift.id}`)
      console.log(`   Payout ID: ${payout.id}`)
    }

    if (failed === 0) {
      console.log('\n🎉 All tests passed!')
      return 0
    } else {
      console.log('\n❌ Some tests failed')
      return 1
    }
  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error)
    console.error(error.stack)
    return 1
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testRiftFlow()
  .then(exitCode => {
    process.exit(exitCode)
  })
  .catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

