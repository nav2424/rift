/**
 * Check if a rift was released but wallet wasn't credited, and fix it
 * Usage: npx tsx scripts/check-and-fix-wallet-credit.ts <riftId>
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { prisma } from '../lib/prisma'
import { creditSellerOnRelease } from '../lib/wallet'
import { calculateSellerNet } from '../lib/fees'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const riftId = process.argv[2]
  
  if (!riftId) {
    console.error('Usage: npx tsx scripts/check-and-fix-wallet-credit.ts <riftId>')
    process.exit(1)
  }

  console.log(`🔍 Checking Rift ${riftId}...\n`)

  // Get rift
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  })

  if (!rift) {
    console.error(`❌ Rift not found: ${riftId}`)
    process.exit(1)
  }

  console.log(`📋 Rift #${rift.riftNumber || riftId.slice(-8)}`)
  console.log(`   Title: ${rift.itemTitle}`)
  console.log(`   Status: ${rift.status}`)
  console.log(`   Subtotal: ${rift.currency} ${rift.subtotal || 0}`)
  console.log(`   Seller: ${rift.seller.email}`)
  console.log(`   Seller Net: ${rift.sellerNet || 'NOT SET'}\n`)

  // Check if rift is RELEASED
  if (rift.status !== 'RELEASED') {
    console.log(`⚠️  Rift is not in RELEASED status (current: ${rift.status})`)
    console.log(`   Wallet will be credited when rift is released.`)
    process.exit(0)
  }

  // Calculate seller net
  let sellerNet = rift.sellerNet
  if (!sellerNet && rift.subtotal) {
    sellerNet = calculateSellerNet(rift.subtotal)
    console.log(`📊 Calculated seller net: ${rift.currency} ${sellerNet.toFixed(2)}`)
  }

  if (!sellerNet) {
    console.error(`❌ Cannot calculate seller net - subtotal is missing`)
    process.exit(1)
  }

  // Check wallet
  const wallet = await prisma.walletAccount.findUnique({
    where: { userId: rift.sellerId },
  })

  if (!wallet) {
    console.log(`📝 Wallet account doesn't exist - will be created when crediting`)
  } else {
    console.log(`💰 Current wallet balance: ${wallet.currency} ${wallet.availableBalance.toFixed(2)}`)
  }

  // Check if ledger entry exists for this rift
  let ledgerEntry
  if (wallet) {
    ledgerEntry = await prisma.walletLedgerEntry.findFirst({
      where: {
        walletAccountId: wallet.id,
        relatedRiftId: riftId,
        type: 'CREDIT_RELEASE',
      },
    })
  }

  if (ledgerEntry) {
    console.log(`✅ Wallet was already credited for this rift`)
    console.log(`   Ledger entry: ${ledgerEntry.id}`)
    console.log(`   Amount credited: ${ledgerEntry.currency} ${ledgerEntry.amount}`)
    console.log(`   Date: ${ledgerEntry.createdAt.toISOString()}`)
    
    if (wallet && wallet.availableBalance < sellerNet) {
      console.log(`\n⚠️  WARNING: Ledger entry exists but wallet balance seems low!`)
      console.log(`   Expected balance to be at least: ${rift.currency} ${sellerNet.toFixed(2)}`)
      console.log(`   Current balance: ${rift.currency} ${wallet.availableBalance.toFixed(2)}`)
      console.log(`   This might indicate funds were withdrawn or there was another transaction.`)
    }
    process.exit(0)
  }

  // Wallet not credited - credit it now
  console.log(`\n⚠️  Wallet was NOT credited for this rift!`)
  console.log(`   Crediting wallet now...`)

  try {
    await creditSellerOnRelease(
      riftId,
      rift.sellerId,
      sellerNet,
      rift.currency,
      {
        riftNumber: rift.riftNumber,
        itemTitle: rift.itemTitle,
        fixedByScript: true,
        fixedAt: new Date().toISOString(),
      }
    )

    // Verify the credit
    const updatedWallet = await prisma.walletAccount.findUnique({
      where: { userId: rift.sellerId },
    })

    if (updatedWallet) {
      console.log(`✅ Wallet credited successfully!`)
      console.log(`   New balance: ${updatedWallet.currency} ${updatedWallet.availableBalance.toFixed(2)}`)
      console.log(`   Amount credited: ${rift.currency} ${sellerNet.toFixed(2)}`)
    } else {
      console.log(`✅ Wallet credit function completed`)
    }

    console.log(`\n✅ Fix complete!`)
  } catch (error: any) {
    console.error(`❌ Error crediting wallet:`, error.message)
    console.error(error)
    process.exit(1)
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
