import { prisma } from '../lib/prisma'
import { ensureRiftUserId } from '../lib/rift-user-id'

/**
 * Backfill Rift IDs for all users who don't have one
 * Run this script to assign Rift IDs to existing users
 */
async function backfillRiftIds() {
  try {
    console.log('Starting Rift ID backfill...')

    // Find all users without Rift IDs
    const usersWithoutRiftId = await prisma.user.findMany({
      where: {
        riftUserId: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    console.log(`Found ${usersWithoutRiftId.length} users without Rift IDs`)

    if (usersWithoutRiftId.length === 0) {
      console.log('All users already have Rift IDs!')
      return
    }

    // Assign Rift IDs to each user
    for (const user of usersWithoutRiftId) {
      try {
        const riftUserId = await ensureRiftUserId(user.id)
        console.log(`✓ Assigned ${riftUserId} to ${user.email} (${user.name || 'No name'})`)
      } catch (error) {
        console.error(`✗ Failed to assign Rift ID to ${user.email}:`, error)
      }
    }

    console.log('\n✅ Rift ID backfill completed!')
  } catch (error) {
    console.error('Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillRiftIds()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

