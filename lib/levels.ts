/**
 * Level system for Rift
 * Calculates user levels based on transaction stats
 */

export type UserLevel = 'ROOKIE' | 'SELLER' | 'VERIFIED_SELLER' | 'TRUSTED_PRO' | 'ELITE'

export interface LevelThreshold {
  minAmount: number
  minTransactions: number
  level: UserLevel
  xp: number
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  {
    minAmount: 0,
    minTransactions: 0,
    level: 'ROOKIE',
    xp: 0,
  },
  {
    minAmount: 200,
    minTransactions: 3,
    level: 'SELLER',
    xp: 100,
  },
  {
    minAmount: 1000,
    minTransactions: 10,
    level: 'VERIFIED_SELLER',
    xp: 500,
  },
  {
    minAmount: 5000,
    minTransactions: 30,
    level: 'TRUSTED_PRO',
    xp: 2000,
  },
  {
    minAmount: 20000,
    minTransactions: 100,
    level: 'ELITE',
    xp: 10000,
  },
]

/**
 * Calculate user level from stats
 */
export function getLevelFromStats(
  totalProcessedAmount: number,
  numCompletedTransactions: number
): UserLevel {
  // Find the highest level the user qualifies for
  let currentLevel: UserLevel = 'ROOKIE'

  for (const threshold of LEVEL_THRESHOLDS) {
    if (
      totalProcessedAmount >= threshold.minAmount ||
      numCompletedTransactions >= threshold.minTransactions
    ) {
      currentLevel = threshold.level
    } else {
      break
    }
  }

  return currentLevel
}

/**
 * Calculate XP from stats
 */
export function getXpFromStats(
  totalProcessedAmount: number,
  numCompletedTransactions: number
): number {
  // Base XP from transactions
  const transactionXp = numCompletedTransactions * 10

  // XP from amount (1 XP per $10 processed)
  const amountXp = Math.floor(totalProcessedAmount / 10)

  return transactionXp + amountXp
}

/**
 * Get progress to next level
 */
export function getProgressToNextLevel(
  currentLevel: UserLevel,
  totalProcessedAmount: number,
  numCompletedTransactions: number
): {
  nextLevel: UserLevel | null
  progress: number // 0-1
  remainingAmount: number
  remainingTransactions: number
  message: string
} {
  const currentIndex = LEVEL_THRESHOLDS.findIndex((t) => t.level === currentLevel)
  const nextThreshold = LEVEL_THRESHOLDS[currentIndex + 1]

  if (!nextThreshold) {
    return {
      nextLevel: null,
      progress: 1,
      remainingAmount: 0,
      remainingTransactions: 0,
      message: 'Max level reached!',
    }
  }

  // Calculate progress based on both amount and transactions
  const amountProgress = Math.min(1, totalProcessedAmount / nextThreshold.minAmount)
  const transactionProgress = Math.min(1, numCompletedTransactions / nextThreshold.minTransactions)
  const progress = Math.max(amountProgress, transactionProgress)

  const remainingAmount = Math.max(0, nextThreshold.minAmount - totalProcessedAmount)
  const remainingTransactions = Math.max(0, nextThreshold.minTransactions - numCompletedTransactions)

  let message = ''
  if (remainingAmount > 0 && remainingTransactions > 0) {
    message = `$${remainingAmount.toFixed(0)} or ${remainingTransactions} transactions to reach ${nextThreshold.level.replace('_', ' ')}`
  } else if (remainingAmount > 0) {
    message = `$${remainingAmount.toFixed(0)} to reach ${nextThreshold.level.replace('_', ' ')}`
  } else if (remainingTransactions > 0) {
    message = `${remainingTransactions} transactions to reach ${nextThreshold.level.replace('_', ' ')}`
  } else {
    message = `Ready to level up to ${nextThreshold.level.replace('_', ' ')}!`
  }

  return {
    nextLevel: nextThreshold.level,
    progress,
    remainingAmount,
    remainingTransactions,
    message,
  }
}

/**
 * Get level display name
 */
export function getLevelDisplayName(level: UserLevel): string {
  return level
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

