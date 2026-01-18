/**
 * Find rift by rift number
 * Usage: npx tsx scripts/find-rift-by-number.ts <riftNumber>
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { prisma } from '../lib/prisma'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const riftNumber = process.argv[2]
  
  if (!riftNumber) {
    console.error('Usage: npx tsx scripts/find-rift-by-number.ts <riftNumber>')
    console.error('Example: npx tsx scripts/find-rift-by-number.ts 1039')
    process.exit(1)
  }

  const riftNumberInt = parseInt(riftNumber, 10)
  if (isNaN(riftNumberInt)) {
    console.error('Error: Rift number must be a number')
    process.exit(1)
  }

  console.log(`🔍 Searching for Rift #${riftNumberInt}...\n`)

  try {
    // Search by riftNumber
    const rifts = await prisma.riftTransaction.findMany({
      where: {
        riftNumber: riftNumberInt,
      },
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        status: true,
        subtotal: true,
        currency: true,
        sellerId: true,
        buyerId: true,
        createdAt: true,
        releasedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (rifts.length === 0) {
      console.log(`❌ No rift found with number ${riftNumberInt}`)
      
      // Try searching recent rifts to see what's available
      console.log('\n📋 Recent rifts in database:')
      const recentRifts = await prisma.riftTransaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          riftNumber: true,
          itemTitle: true,
          status: true,
          createdAt: true,
        },
      })
      
      for (const r of recentRifts) {
        console.log(`   Rift #${r.riftNumber}: ${r.id} - ${r.status} - ${r.itemTitle}`)
      }
    } else {
      for (const rift of rifts) {
        console.log(`✅ Found Rift #${rift.riftNumber}:`)
        console.log(`   ID: ${rift.id}`)
        console.log(`   Title: ${rift.itemTitle}`)
        console.log(`   Status: ${rift.status}`)
        console.log(`   Amount: ${rift.currency} ${rift.subtotal || 0}`)
        console.log(`   Created: ${rift.createdAt.toISOString()}`)
        if (rift.releasedAt) {
          console.log(`   Released: ${rift.releasedAt.toISOString()}`)
        }
        console.log(`   Seller ID: ${rift.sellerId}`)
        console.log(`   Buyer ID: ${rift.buyerId}`)
        console.log('')
      }
    }
  } catch (error: any) {
    console.error('❌ Error searching for rift:', error.message)
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
