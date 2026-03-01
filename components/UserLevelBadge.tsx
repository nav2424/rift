'use client'

type UserLevel = 'ROOKIE' | 'SELLER' | 'VERIFIED_SELLER' | 'TRUSTED_PRO' | 'ELITE'

interface LevelThreshold {
  minAmount: number
  minTransactions: number
  level: UserLevel
}

const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { minAmount: 0, minTransactions: 0, level: 'ROOKIE' },
  { minAmount: 200, minTransactions: 3, level: 'SELLER' },
  { minAmount: 1000, minTransactions: 10, level: 'VERIFIED_SELLER' },
  { minAmount: 5000, minTransactions: 30, level: 'TRUSTED_PRO' },
  { minAmount: 20000, minTransactions: 100, level: 'ELITE' },
]

function getLevelDisplayName(level: UserLevel): string {
  return level
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

function getProgressToNextLevel(
  currentLevel: UserLevel,
  totalProcessedAmount: number,
  numCompletedTransactions: number
): {
  nextLevel: UserLevel | null
  progress: number
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

interface UserLevelBadgeProps {
  level: UserLevel
  totalProcessedAmount: number
  numCompletedTransactions: number
  className?: string
}

export default function UserLevelBadge({
  level,
  totalProcessedAmount,
  numCompletedTransactions,
  className = '',
}: UserLevelBadgeProps) {
  const progress = getProgressToNextLevel(level, totalProcessedAmount, numCompletedTransactions)
  const displayName = getLevelDisplayName(level)

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-xl">
          <span className="text-sm font-light text-[#86868b] uppercase tracking-wide">
            Level
          </span>
          <div className="text-xl font-light text-[#1d1d1f] mt-1">
            {displayName}
          </div>
        </div>
      </div>

      {progress.nextLevel && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#86868b]">
            <span>Progress to {getLevelDisplayName(progress.nextLevel)}</span>
            <span>{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500/50 to-purple-500/50 transition-all duration-500"
              style={{ width: `${progress.progress * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 font-light">{progress.message}</p>
        </div>
      )}

      {!progress.nextLevel && (
        <div className="flex items-center gap-2 text-xs text-[#86868b] font-light">
          <svg className="w-4 h-4 text-yellow-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span>Max level reached!</span>
        </div>
      )}
    </div>
  )
}
