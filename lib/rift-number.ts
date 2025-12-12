import { prisma } from './prisma'

/**
 * Generates the next sequential rift number
 * This ensures each rift gets a unique, sequential number for easy tracking
 */
export async function generateNextRiftNumber(): Promise<number> {
  // Find the highest existing rift number
  const lastEscrow = await prisma.escrowTransaction.findFirst({
    orderBy: {
      riftNumber: 'desc',
    },
    select: {
      riftNumber: true,
    },
  })

  // Start from 1000 if no rifts exist, otherwise increment by 1
  const nextNumber = lastEscrow ? lastEscrow.riftNumber + 1 : 1000

  return nextNumber
}

