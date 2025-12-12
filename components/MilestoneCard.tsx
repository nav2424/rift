'use client'

import GlassCard from './ui/GlassCard'

interface Milestone {
  id: string
  type: string
  title: string
  description: string
  achievedAt: string
}

interface MilestoneCardProps {
  milestone: Milestone
}

export default function MilestoneCard({ milestone }: MilestoneCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <GlassCard className="hover:bg-white/5 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-light text-white">
                {milestone.title}
              </h3>
              <svg className="w-5 h-5 text-yellow-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-sm text-white/60 font-light">
              {milestone.description}
            </p>
          </div>
        </div>
        <p className="text-xs text-white/40 font-light mt-2">
          Achieved {formatDate(milestone.achievedAt)}
        </p>
      </div>
    </GlassCard>
  )
}

