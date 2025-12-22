import { prisma } from '../lib/prisma'
import { generateNextRiftUserId } from '../lib/rift-user-id'

async function main() {
  console.log('Starting Rift User ID backfill...')

  // Find all users without Rift User IDs
  const usersWithoutRiftId = await prisma.user.findMany({
    where: {
      riftUserId: null,
    },
    orderBy: {
      createdAt: 'asc', // Assign IDs in order of account creation
    },
  })

  console.log(`Found ${usersWithoutRiftId.length} users without Rift User IDs`)

  // Get all existing Rift User IDs to find the current max
  const existingUsers = await prisma.user.findMany({
    where: {
      riftUserId: {
        not: null,
      },
    },
    select: {
      riftUserId: true,
    },
  })

  // Find the maximum existing number
  let maxExistingNumber = 0
  for (const user of existingUsers) {
    if (user.riftUserId) {
      const match = user.riftUserId.match(/RIFT(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxExistingNumber) {
          maxExistingNumber = num
        }
      }
    }
  }

  // Determine starting number: use 111111 if max is below it, otherwise continue from max
  let currentNumber = maxExistingNumber < 111111 ? 111110 : maxExistingNumber

  // Assign IDs starting from the next number
  for (const user of usersWithoutRiftId) {
    try {
      currentNumber++
      const riftUserId = `RIFT${currentNumber.toString().padStart(6, '0')}`

      // Assign to user
      await prisma.user.update({
        where: { id: user.id },
        data: { riftUserId },
      })

      console.log(`✅ Assigned ${riftUserId} to user ${user.email} (${user.id})`)
    } catch (error) {
      console.error(`❌ Error assigning Rift User ID to user ${user.email}:`, error)
    }
  }

  console.log('✅ Backfill complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
