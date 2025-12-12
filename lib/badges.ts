/**
 * Trust badge system for Rift
 * Awards badges when users meet criteria
 */

import { prisma } from './prisma'

export interface BadgeDefinition {
  code: string
  label: string
  description: string
  icon?: string
  check: (user: {
    idVerified: boolean
    bankVerified: boolean
    numCompletedTransactions: number
    averageRating: number | null
    responseTimeMs: number | null
    totalProcessedAmount: number
  }) => boolean
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    code: 'ID_VERIFIED',
    label: 'ID Verified',
    description: 'Completed identity verification',
    icon: 'shield-checkmark',
    check: (user) => user.idVerified,
  },
  {
    code: 'BANK_VERIFIED',
    label: 'Bank Verified',
    description: 'Connected and verified bank account',
    icon: 'card',
    check: (user) => user.bankVerified,
  },
  {
    code: 'TWENTY_TRANSACTIONS',
    label: '20+ Transactions',
    description: 'Completed 20 successful transactions',
    icon: 'trophy',
    check: (user) => user.numCompletedTransactions >= 20,
  },
  {
    code: 'FIVE_STAR_RATING',
    label: 'Five Star',
    description: 'Maintains 4.8+ average rating',
    icon: 'star',
    check: (user) => (user.averageRating ?? 0) >= 4.8,
  },
  {
    code: 'FAST_RESPONDER',
    label: 'Fast Responder',
    description: 'Average response time under 2 hours',
    icon: 'flash',
    check: (user) => (user.responseTimeMs ?? Infinity) <= 2 * 60 * 60 * 1000, // 2 hours in ms
  },
  {
    code: 'HIGH_VOLUME_SELLER',
    label: 'High Volume Seller',
    description: 'Processed over $5,000',
    icon: 'trending-up',
    check: (user) => user.totalProcessedAmount >= 5000,
  },
  {
    code: 'TRUSTED_MEMBER',
    label: 'Trusted Member',
    description: '50+ completed transactions',
    icon: 'people',
    check: (user) => user.numCompletedTransactions >= 50,
  },
]

/**
 * Ensure all badges exist in database
 */
export async function ensureBadgesExist() {
  for (const definition of BADGE_DEFINITIONS) {
    // @ts-ignore - Prisma client will be generated after migration
    await prisma.badge.upsert({
      where: { code: definition.code },
      update: {
        label: definition.label,
        description: definition.description,
        icon: definition.icon,
      },
      create: {
        code: definition.code,
        label: definition.label,
        description: definition.description,
        icon: definition.icon,
      },
    })
  }
}

/**
 * Check and award badges for a user
 * Returns array of newly awarded badge codes
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  // Ensure badges exist
  await ensureBadgesExist()

  // Get user with stats
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      idVerified: true,
      bankVerified: true,
      numCompletedTransactions: true,
      averageRating: true,
      responseTimeMs: true,
      totalProcessedAmount: true,
    },
  })

  if (!user) {
    return []
  }

  // Get existing badges
  // @ts-ignore - Prisma client will be generated after migration
  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
  })

  const existingCodes = new Set(existingBadges.map((ub: any) => ub.badge.code))
  const newlyAwarded: string[] = []

  // Check each badge definition
  for (const definition of BADGE_DEFINITIONS) {
    // Skip if already awarded
    if (existingCodes.has(definition.code)) {
      continue
    }

    // Check if criteria is met
    if (definition.check(user)) {
      // Get badge
      // @ts-ignore - Prisma client will be generated after migration
      const badge = await prisma.badge.findUnique({
        where: { code: definition.code },
      })

      if (badge) {
        // Award badge
        // @ts-ignore - Prisma client will be generated after migration
        await prisma.userBadge.create({
          data: {
            userId,
            badgeId: badge.id,
          },
        })

        newlyAwarded.push(definition.code)
      }
    }
  }

  return newlyAwarded
}

/**
 * Get user's badges
 */
export async function getUserBadges(userId: string) {
  // @ts-ignore - Prisma client will be generated after migration
  return prisma.userBadge.findMany({
    where: { userId },
    include: {
      badge: true,
    },
    orderBy: {
      awardedAt: 'desc',
    },
  })
}

