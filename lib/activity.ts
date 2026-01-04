/**
 * Activity feed system for Rift
 * Creates and manages activity feed entries
 */

import { prisma } from './prisma'

export type ActivityType = 
  | 'RIFT_CREATED'
  | 'RIFT_PAID'
  | 'PAYMENT_RECEIVED'
  | 'PROOF_SUBMITTED'
  | 'PROOF_APPROVED'
  | 'PROOF_REJECTED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'FUNDS_RELEASED'
  | 'DEAL_CLOSED'
  | 'REPEATED_SALES_DAY'
  | 'MILESTONE_ACHIEVED'
  | 'LEVEL_UP'
  | 'BADGE_EARNED'

/**
 * Create an activity entry
 */
export async function createActivity(
  userId: string,
  type: ActivityType,
  summary: string,
  amount?: number,
  metadata?: Record<string, any>
) {
  // @ts-ignore - Prisma client will be generated after migration
  return prisma.activity.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      type,
      summary,
      amount: amount ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}

/**
 * Get activity feed for display
 * Returns activities from users who have opted in, respecting privacy settings
 */
export async function getActivityFeed(limit: number = 50) {
  // @ts-ignore - Prisma client will be generated after migration
  const activities = await prisma.activity.findMany({
    where: {
      User: {
        showInActivityFeed: true,
      },
    },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          email: true,
          showAmountsInFeed: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })

  // Format activities with privacy controls
  return activities.map((activity: any) => {
    let summary = activity.summary

    // Mask amounts if user has disabled amount display
    if (!activity.User.showAmountsInFeed && activity.amount) {
      // Remove amount from summary if present
      summary = summary.replace(/\$[\d,]+\.?\d*/g, 'an amount')
      summary = summary.replace(/for \$[\d,]+\.?\d*/g, 'for an amount')
    }

    // Format user name (first name + last initial)
    const userName = formatUserName(activity.User.name || activity.User.email)

    return {
      id: activity.id,
      type: activity.type,
      summary: `${userName} ${summary}`,
      amount: activity.User.showAmountsInFeed ? activity.amount : null,
      createdAt: activity.createdAt,
    }
  })
}

/**
 * Get user activities (for personal activity feed)
 * Returns all activities for a specific user
 */
export async function getUserActivities(userId: string, limit: number = 100) {
  const activities = await prisma.activity.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })

  return activities.map((activity: any) => {
    let metadata = {}
    try {
      metadata = activity.metadata ? JSON.parse(activity.metadata) : {}
    } catch (e) {
      // Invalid JSON, ignore
    }

    return {
      id: activity.id,
      type: activity.type,
      summary: activity.summary,
      amount: activity.amount,
      metadata,
      createdAt: activity.createdAt,
    }
  })
}

/**
 * Format user name for privacy
 */
function formatUserName(nameOrEmail: string): string {
  if (!nameOrEmail.includes('@')) {
    // It's a name
    const parts = nameOrEmail.split(' ')
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
    }
    return parts[0]
  }

  // It's an email, use first part
  return nameOrEmail.split('@')[0]
}

