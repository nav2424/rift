/**
 * Find recently released rifts that might need wallet credit check
 * Usage: npx tsx scripts/find-recent-released-rifts.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { prisma } from '../lib/prisma'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function main() {
  console.log('🔍 Searching for recently released rifts...\n')

  try {
    // Find recently released rifts
    const releasedRifts = await prisma.riftTransaction.findMany({
      where: {
        status: 'RELEASED',
      },
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        status: true,
        subtotal: true,
        currency: true,
        sellerNet: true,
        sellerId: true,
        releasedAt: true,
        createdAt: true,
        seller: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        releasedAt: 'desc',
      },
      take: 20,
    })

    if (releasedRifts.length === 0) {
      console.log('❌ No released rifts found')
      return
    }

    console.log(`Found ${releasedRifts.length} recently released rift(s):\n`)

    for (const rift of releasedRifts) {
      // Check if wallet was credited
      const wallet = await prisma.walletAccount.findUnique({
        where: { userId: rift.sellerId },
      })

      let ledgerEntry = null
      if (wallet) {
        ledgerEntry = await prisma.walletLedgerEntry.findFirst({
          where: {
            walletAccountId: wallet.id,
            relatedRiftId: rift.id,
            type: 'CREDIT_RELEASE',
          },
        })
      }

      const walletCredited = !!ledgerEntry
      const walletBalance = wallet?.availableBalance || 0

      console.log(`📋 Rift #${rift.riftNumber}:`)
      console.log(`   ID: ${rift.id}`)
      console.log(`   Title: ${rift.itemTitle}`)
      console.log(`   Amount: ${rift.currency} ${rift.subtotal || 0}`)
      console.log(`   Seller Net: ${rift.currency} ${rift.sellerNet || 'NOT SET'}`)
      console.log(`   Seller: ${rift.seller.email}`)
      console.log(`   Released: ${rift.releasedAt?.toISOString() || 'N/A'}`)
      console.log(`   Wallet Credited: ${walletCredited ? '✅ YES' : '❌ NO'}`)
      if (wallet) {
        console.log(`   Wallet Balance: ${wallet.currency} ${walletBalance.toFixed(2)}`)
      } else {
        console.log(`   Wallet: Not created yet`)
      }
      if (!walletCredited && rift.sellerNet) {
        console.log(`   ⚠️  WALLET NOT CREDITED - Run: npx tsx scripts/check-and-fix-wallet-credit.ts ${rift.id}`)
      }
      console.log('')
    }

    console.log('\n💡 To fix a specific rift, run:')
    console.log('   npx tsx scripts/check-and-fix-wallet-credit.ts <riftId>')
  } catch (error: any) {
    console.error('❌ Error searching for rifts:', error.message)
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
