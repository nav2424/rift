'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { useToast } from './ui/Toast'
import { useRouter } from 'next/navigation'

interface Milestone {
  index: number
  title: string
  description: string
  deliverables: string
  amount: number
  dueDate: string
  reviewWindowDays: number
  revisionLimit: number
  dealType?: string | null
  reviewWindowEndsAt?: string | Date | null
  revisionRequests?: number
  released: boolean
  releaseDate: string | null
  sellerNet: number | null
}

interface MilestoneCardProps {
  riftId: string
  currency: string
  isBuyer: boolean
  riftStatus: string
}

export default function MilestoneCard({ riftId, currency, isBuyer, riftStatus }: MilestoneCardProps) {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const router = useRouter()
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [releasingIndex, setReleasingIndex] = useState<number | null>(null)
  const [releasingAll, setReleasingAll] = useState(false)
  const [allReleased, setAllReleased] = useState(false)
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number | null>(null)
  const [autoReleaseAt, setAutoReleaseAt] = useState<string | null>(null)
  const [autoReleaseScheduled, setAutoReleaseScheduled] = useState(false)
  const [requestingRevisionIndex, setRequestingRevisionIndex] = useState<number | null>(null)

  const currencySymbols: Record<string, string> = {
    CAD: '$',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AUD: '$',
    JPY: '¥',
  }

  const currencySymbol = currencySymbols[currency] || currency

  useEffect(() => {
    fetchMilestones()
  }, [riftId])

  const fetchMilestones = async () => {
    try {
      const response = await fetch(`/api/rifts/${riftId}/milestones`)
      if (!response.ok) {
        throw new Error('Failed to fetch milestones')
      }
      const data = await response.json()
      setMilestones(data.milestones || [])
      setAllReleased(data.allReleased || false)
      setActiveMilestoneIndex(data.activeMilestoneIndex ?? null)
      setAutoReleaseAt(data.autoReleaseAt ?? null)
      setAutoReleaseScheduled(!!data.autoReleaseScheduled)
    } catch (error) {
      console.error('Error fetching milestones:', error)
      showToast('Failed to load milestones', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleReleaseMilestone = async (index: number) => {
    if (!isBuyer) {
      showToast('Only buyers can release milestone funds', 'error')
      return
    }

    if (riftStatus !== 'FUNDED' && riftStatus !== 'PROOF_SUBMITTED' && riftStatus !== 'UNDER_REVIEW') {
      showToast('Rift must be funded before releasing milestones', 'error')
      return
    }

    if (!confirm(`Are you sure you want to release funds for "${milestones[index].title}"?`)) {
      return
    }

    setReleasingIndex(index)
    try {
      const response = await fetch(`/api/rifts/${riftId}/milestones/${index}/release`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to release milestone')
      }

      const data = await response.json()
      showToast(`Milestone "${milestones[index].title}" released successfully!`, 'success')
      
      // Refresh milestones
      await fetchMilestones()
      
      // Refresh page to update rift status if all milestones are released
      if (data.milestoneRelease?.allMilestonesReleased) {
        router.refresh()
      }
    } catch (error: any) {
      console.error('Error releasing milestone:', error)
      showToast(error.message || 'Failed to release milestone', 'error')
    } finally {
      setReleasingIndex(null)
    }
  }

  const handleReleaseAll = async () => {
    if (!isBuyer) {
      showToast('Only buyers can release milestone funds', 'error')
      return
    }

    if (riftStatus !== 'FUNDED' && riftStatus !== 'PROOF_SUBMITTED' && riftStatus !== 'UNDER_REVIEW') {
      showToast('Rift must be funded before releasing milestones', 'error')
      return
    }

    const unreleasedCount = milestones.filter((m) => !m.released).length
    if (unreleasedCount === 0) {
      showToast('All milestones have already been released', 'info')
      return
    }

    if (!confirm(`Are you sure you want to release ALL remaining funds (${unreleasedCount} milestone${unreleasedCount > 1 ? 's' : ''}) to the seller? This action cannot be undone.`)) {
      return
    }

    setReleasingAll(true)
    try {
      const response = await fetch(`/api/rifts/${riftId}/milestones/release-all`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to release all milestones')
      }

      const data = await response.json()
      showToast(`Successfully released ${data.releasedCount} milestone${data.releasedCount > 1 ? 's' : ''}!`, 'success')
      
      // Refresh milestones
      await fetchMilestones()
      
      // Refresh page to update rift status
      router.refresh()
    } catch (error: any) {
      console.error('Error releasing all milestones:', error)
      showToast(error.message || 'Failed to release all milestones', 'error')
    } finally {
      setReleasingAll(false)
    }
  }

  const handleRequestRevision = async (index: number) => {
    if (!isBuyer) {
      showToast('Only buyers can request revisions', 'error')
      return
    }
    if (!['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(riftStatus)) {
      showToast('Revisions can only be requested during review', 'error')
      return
    }

    const reason = window.prompt('Optional: Add a short revision request note') || ''

    setRequestingRevisionIndex(index)
    try {
      const response = await fetch(`/api/rifts/${riftId}/milestones/${index}/request-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to request revision')
      }
      showToast('Revision request sent to the creator', 'success')
      await fetchMilestones()
    } catch (error: any) {
      console.error('Revision request error:', error)
      showToast(error.message || 'Failed to request revision', 'error')
    } finally {
      setRequestingRevisionIndex(null)
    }
  }

  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-1/3"></div>
          <div className="h-4 bg-gray-100 rounded"></div>
          <div className="h-4 bg-gray-100 rounded w-2/3"></div>
        </div>
      </GlassCard>
    )
  }

  if (milestones.length === 0) {
    return null
  }

  const canRelease = isBuyer && 
    (riftStatus === 'FUNDED' || riftStatus === 'PROOF_SUBMITTED' || riftStatus === 'UNDER_REVIEW') &&
    !allReleased

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-light text-[#1d1d1f]">Payment Milestones</h3>
          <p className="text-sm text-[#86868b] font-light">
            {milestones.filter((m) => m.released).length} of {milestones.length} released
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone, index) => {
          const isOverdue = !milestone.released && new Date(milestone.dueDate) < new Date()
          const canReleaseThis = canRelease && !milestone.released
          const isActiveMilestone = activeMilestoneIndex === milestone.index
          const reviewWindowExpired = milestone.reviewWindowEndsAt
            ? new Date(milestone.reviewWindowEndsAt) < new Date()
            : false
          const revisionLimitReached =
            typeof milestone.revisionRequests === 'number' &&
            milestone.revisionRequests >= milestone.revisionLimit
          const canRequestRevision =
            isBuyer &&
            isActiveMilestone &&
            !milestone.released &&
            ['PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(riftStatus)

          return (
            <div
              key={index}
              className={`p-5 rounded-xl border transition-all ${
                milestone.released
                  ? 'bg-green-500/10 border-green-500/30'
                  : isOverdue
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-[#86868b] font-light">
                      Milestone {index + 1}
                    </span>
                    {milestone.released && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-green-500/20 text-green-300 font-light">
                        ✓ Released
                      </span>
                    )}
                    {isOverdue && !milestone.released && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-300 font-light">
                        Overdue
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-light text-[#1d1d1f] mb-1">{milestone.title}</h4>
                  {milestone.description && (
                    <p className="text-sm text-[#86868b] font-light mb-2">{milestone.description}</p>
                  )}
                {milestone.deliverables && (
                  <p className="text-sm text-gray-600 font-light mb-2">
                    Deliverables: {milestone.deliverables}
                  </p>
                )}
                <p className="text-xs text-[#86868b] font-light">
                  Review window: {milestone.reviewWindowDays} day{milestone.reviewWindowDays === 1 ? '' : 's'} • 1 revision included
                </p>
                {typeof milestone.revisionRequests === 'number' && (
                  <p className="text-xs text-gray-400 font-light mt-1">
                    Revisions used: {Math.min(milestone.revisionRequests, milestone.revisionLimit)} / {milestone.revisionLimit}
                  </p>
                )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-light text-[#1d1d1f]">
                    {currencySymbol} {milestone.amount.toFixed(2)}
                  </p>
                  {milestone.released && milestone.sellerNet && !isBuyer && (
                    <p className="text-xs text-[#86868b] font-light mt-1">
                      You'll receive: {currencySymbol} {milestone.sellerNet.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div>
                  <p className="text-xs text-[#86868b] font-light">
                    Due: {new Date(milestone.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  {milestone.reviewWindowEndsAt && (
                    <p className="text-xs text-emerald-300/80 font-light mt-1">
                      Review window ends on {new Date(milestone.reviewWindowEndsAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                  {milestone.released && milestone.releaseDate && (
                    <p className="text-xs text-green-300/70 font-light mt-1">
                      Released: {new Date(milestone.releaseDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {canRequestRevision && (
                    <PremiumButton
                      onClick={() => handleRequestRevision(index)}
                      disabled={requestingRevisionIndex === index || reviewWindowExpired || revisionLimitReached}
                      className="px-4 py-2 text-sm"
                      variant="outline"
                    >
                      {requestingRevisionIndex === index ? 'Requesting...' : 'Request Revision'}
                    </PremiumButton>
                  )}
                  {canReleaseThis && (
                    <PremiumButton
                      onClick={() => handleReleaseMilestone(index)}
                      disabled={releasingIndex === index}
                      className="px-4 py-2 text-sm"
                    >
                      {releasingIndex === index ? 'Releasing...' : 'Release Funds'}
                    </PremiumButton>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Release All Funds button - Supreme button, works unconditionally */}
      {canRelease && !allReleased && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <PremiumButton
            onClick={handleReleaseAll}
            disabled={releasingAll}
            className="w-full py-3 text-base font-medium"
            variant="outline"
          >
            {releasingAll ? 'Releasing All Funds...' : 'Release All Funds'}
          </PremiumButton>
          <p className="text-xs text-[#86868b] font-light text-center mt-2">
            Release all remaining milestone funds to the seller at once
          </p>
        </div>
      )}

      {allReleased && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-300 text-sm font-light text-center">
            ✓ All milestones have been released. Rift is complete.
          </p>
        </div>
      )}
    </GlassCard>
  )
}
