'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import GlassCard from '@/components/ui/GlassCard'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface UserRiskViewProps {
  user: {
    id: string
    name: string | null
    email: string
    createdAt: Date
    role: string
  }
  riskProfile: any
  restrictions: any
  enforcementActions: any[]
}

export default function UserRiskView({
  user,
  riskProfile,
  restrictions,
  enforcementActions,
}: UserRiskViewProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [categoryToBlock, setCategoryToBlock] = useState('')

  const handleRestrictionAction = async (action: string, category?: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/risk/users/${user.id}/restrictions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [action]: true,
          category: category || categoryToBlock,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Action failed', 'error')
        return
      }

      showToast('Action completed successfully', 'success')
      router.refresh()
    } catch (error: any) {
      console.error(`Error performing ${action}:`, error)
      showToast(error.message || 'Failed to perform action', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (score >= 60) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    if (score >= 30) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    return 'bg-green-500/20 text-green-400 border-green-500/30'
  }

  return (
    <div className="space-y-8">
      {/* User Info */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-light text-white mb-4">User Information</h2>
        <div className="space-y-2 text-white/80 text-sm">
          <p><strong>Name:</strong> {user.name || 'N/A'}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role}</p>
          <p><strong>Account Created:</strong> {format(new Date(user.createdAt), 'MMM dd, yyyy')}</p>
        </div>
      </GlassCard>

      {/* Risk Profile */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-light text-white mb-4">Risk Profile</h2>
        {riskProfile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/60 text-sm mb-1">Buyer Risk Score</p>
                <Badge className={getRiskScoreColor(riskProfile.buyer_risk_score)}>
                  {riskProfile.buyer_risk_score}/100
                </Badge>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Seller Risk Score</p>
                <Badge className={getRiskScoreColor(riskProfile.seller_risk_score)}>
                  {riskProfile.seller_risk_score}/100
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-white/80 text-sm">
              <div>
                <p><strong>Strikes:</strong> {riskProfile.strikes}</p>
                <p><strong>Chargebacks:</strong> {riskProfile.chargebacks}</p>
                <p><strong>Disputes Opened:</strong> {riskProfile.disputes_opened}</p>
                <p><strong>Disputes Lost:</strong> {riskProfile.disputes_lost}</p>
              </div>
              <div>
                <p><strong>Successful Transactions:</strong> {riskProfile.successful_transactions}</p>
                <p><strong>Total Volume:</strong> ${(riskProfile.total_volume_cents / 100).toFixed(2)}</p>
                {riskProfile.last_chargeback_at && (
                  <p><strong>Last Chargeback:</strong> {format(new Date(riskProfile.last_chargeback_at), 'MMM dd, yyyy')}</p>
                )}
                {riskProfile.last_dispute_at && (
                  <p><strong>Last Dispute:</strong> {format(new Date(riskProfile.last_dispute_at), 'MMM dd, yyyy')}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm">No risk profile found. Profile will be created on first transaction.</p>
        )}
      </GlassCard>

      {/* Restrictions */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-light text-white mb-4">Current Restrictions</h2>
        {restrictions ? (
          <div className="space-y-4">
            <div className="text-white/80 text-sm">
              <p><strong>Funds Frozen:</strong> {restrictions.funds_frozen ? 'Yes' : 'No'}</p>
              {restrictions.frozen_reason && (
                <p className="text-white/60 mt-1">{restrictions.frozen_reason}</p>
              )}
              {restrictions.disputes_restricted_until && (
                <p className="mt-2">
                  <strong>Disputes Restricted Until:</strong>{' '}
                  {format(new Date(restrictions.disputes_restricted_until), 'MMM dd, yyyy HH:mm')}
                </p>
              )}
              {restrictions.categories_blocked && restrictions.categories_blocked.length > 0 && (
                <div className="mt-2">
                  <p><strong>Blocked Categories:</strong></p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {restrictions.categories_blocked.map((cat: string) => (
                      <Badge key={cat} className="bg-red-500/20 text-red-400 border-red-500/30">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm">No restrictions currently active.</p>
        )}
      </GlassCard>

      {/* Admin Actions */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-light text-white mb-4">Admin Actions</h2>
        <div className="space-y-4">
          {restrictions?.disputes_restricted_until && (
            <Button
              onClick={() => handleRestrictionAction('removeDisputesRestriction')}
              disabled={loading}
              variant="outline"
              className="w-full bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Remove Disputes Restriction'}
            </Button>
          )}
          {restrictions?.funds_frozen && (
            <Button
              onClick={() => handleRestrictionAction('unfreezeFunds')}
              disabled={loading}
              variant="outline"
              className="w-full bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Unfreeze Funds'}
            </Button>
          )}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-white/80">Category</Label>
            <Select value={categoryToBlock} onValueChange={setCategoryToBlock}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                <SelectItem value="TICKETS">Tickets</SelectItem>
                <SelectItem value="DIGITAL">Digital</SelectItem>
                <SelectItem value="SERVICES">Services</SelectItem>
                <SelectItem value="PHYSICAL">Physical</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                onClick={() => handleRestrictionAction('addCategoryBlock', categoryToBlock)}
                disabled={loading || !categoryToBlock}
                variant="outline"
                className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Block Category'}
              </Button>
              <Button
                onClick={() => handleRestrictionAction('clearCategoryBlock', categoryToBlock)}
                disabled={loading || !categoryToBlock}
                variant="outline"
                className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Unblock Category'}
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Enforcement Actions History */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-light text-white mb-4">Enforcement Actions History</h2>
        {enforcementActions.length > 0 ? (
          <div className="space-y-2">
            {enforcementActions.map((action: any) => (
              <div
                key={action.id}
                className="p-3 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{action.action_type.replace(/_/g, ' ')}</p>
                    <p className="text-white/60 mt-1">{action.reason}</p>
                    <p className="text-white/40 text-xs mt-1">
                      {format(new Date(action.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60 text-sm">No enforcement actions recorded.</p>
        )}
      </GlassCard>
    </div>
  )
}

