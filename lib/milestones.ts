/**
 * Milestone system for Rift
 * Awards milestones when users hit thresholds
 */

import { prisma } from './prisma'

export type MilestoneType = 
  | 'FIRST_100'
  | 'TEN_TRANSACTIONS'
  | 'FIRST_1000'
  | 'TOP_10_PERCENT'
  | 'TWENTY_TRANSACTIONS'
  | 'FIFTY_TRANSACTIONS'
  | 'FIRST_5000'
  | 'HUNDRED_TRANSACTIONS'

export interface MilestoneDefinition {
  type: MilestoneType
  title: string
  description: string
  check: (totalProcessedAmount: number, numCompletedTransactions: number) => boolean
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    type: 'FIRST_100',
    title: 'Your first $100 on Rift',
    description: 'You\'ve processed your first $100 through Rift!',
    check: (amount) => amount >= 100,
  },
  {
    type: 'TEN_TRANSACTIONS',
    title: '10 Transactions Complete',
    description: 'You\'ve successfully completed 10 transactions!',
    check: (_, transactions) => transactions >= 10,
  },
  {
    type: 'FIRST_1000',
    title: '$1,000 Milestone',
    description: 'You\'ve processed over $1,000 through Rift!',
    check: (amount) => amount >= 1000,
  },
  {
    type: 'TWENTY_TRANSACTIONS',
    title: '20 Transactions Complete',
    description: 'You\'ve successfully completed 20 transactions!',
    check: (_, transactions) => transactions >= 20,
  },
  {
    type: 'FIRST_5000',
    title: '$5,000 Milestone',
    description: 'You\'ve processed over $5,000 through Rift!',
    check: (amount) => amount >= 5000,
  },
  {
    type: 'FIFTY_TRANSACTIONS',
    title: '50 Transactions Complete',
    description: 'You\'ve successfully completed 50 transactions!',
    check: (_, transactions) => transactions >= 50,
  },
  {
    type: 'HUNDRED_TRANSACTIONS',
    title: '100 Transactions Complete',
    description: 'You\'ve successfully completed 100 transactions!',
    check: (_, transactions) => transactions >= 100,
  },
]

/**
 * Check and award milestones for a user
 * Returns array of newly awarded milestone types
 */
export async function checkAndAwardMilestones(
  userId: string,
  totalProcessedAmount: number,
  numCompletedTransactions: number
): Promise<MilestoneType[]> {
  // Get existing milestones
  // @ts-ignore - Prisma client will be generated after migration
  const existingMilestones = await prisma.userMilestone.findMany({
    where: { userId },
    select: { type: true },
  })

      const existingTypes = new Set(existingMilestones.map((m: any) => m.type))
  const newlyAwarded: MilestoneType[] = []

  // Check each milestone definition
  for (const definition of MILESTONE_DEFINITIONS) {
    // Skip if already awarded
    if (existingTypes.has(definition.type)) {
      continue
    }

    // Check if threshold is met
    if (definition.check(totalProcessedAmount, numCompletedTransactions)) {
      // Award milestone
      // @ts-ignore - Prisma client will be generated after migration
      await prisma.userMilestone.create({
        data: {
          userId,
          type: definition.type,
          title: definition.title,
          description: definition.description,
        },
      })

      newlyAwarded.push(definition.type)
    }
  }

  return newlyAwarded
}

/**
 * Get user's recent milestones
 */
export async function getUserMilestones(userId: string, limit: number = 5) {
  // @ts-ignore - Prisma client will be generated after migration
  return prisma.userMilestone.findMany({
    where: { userId },
    orderBy: { achievedAt: 'desc' },
    take: limit,
  })
}

