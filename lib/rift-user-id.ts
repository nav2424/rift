import { prisma } from './prisma'

/**
 * Generates the next sequential Rift user ID
 * This ensures each user gets a unique, sequential ID (e.g., RIFT111111, RIFT111112, etc.)
 * Starting from RIFT111111 for the first user
 */
export async function generateNextRiftUserId(): Promise<string> {
  // Get all users with Rift user IDs and extract numbers to find max
  const usersWithRiftIds = await prisma.user.findMany({
    where: {
      riftUserId: {
        not: null,
      },
    },
    select: {
      riftUserId: true,
    },
  })

  // Extract numbers from all Rift user IDs and find the maximum
  let maxNumber = 0
  for (const user of usersWithRiftIds) {
    if (user.riftUserId) {
      const match = user.riftUserId.match(/RIFT(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    }
  }

  // Determine next number: start from 111111 if no users exist or max is below 111111
  let nextNumber: number
  if (maxNumber === 0 || maxNumber < 111111) {
    // Start from 111111 for new users (first user gets RIFT111111)
    nextNumber = 111111
  } else {
    // Continue sequential numbering if already past 111111
    nextNumber = maxNumber + 1
  }

  // Format as RIFT###### with 6 digits (e.g., RIFT111111, RIFT111112, RIFT111999)
  // First user gets RIFT111111
  return `RIFT${nextNumber.toString().padStart(6, '0')}`
}

/**
 * Assigns a Rift user ID to a user if they don't have one
 */
export async function ensureRiftUserId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { riftUserId: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.riftUserId) {
    return user.riftUserId
  }

  // Generate and assign new Rift user ID
  const riftUserId = await generateNextRiftUserId()
  
  await prisma.user.update({
    where: { id: userId },
    data: { riftUserId },
  })

  return riftUserId
}
