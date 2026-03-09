'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

interface InfluencerProspect {
  id: string
  brandId: string
  email: string | null
  handle: string | null
  name: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface BrandAnalytics {
  totalSpent: number
  activeBudget: number
  thisMonthSpent: number
  totalInfluencers: number
  avgDealCost: number
  activeDeals: number
  currency: string
  topInfluencers: {
    id: string
    name: string
    totalSpent: number
    dealCount: number
  }[]
}

interface Deal {
  id: string
  riftNumber: number | null
  itemTitle: string
  amount: number
  currency: string
  status: string
  createdAt: string
  buyer: { id: string; name: string | null; email: string }
  seller: { id: string; name: string | null; email: string }
}

export default function BrandHubPage() {
  const { status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<BrandAnalytics | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [prospects, setProspects] = useState<InfluencerProspect[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddProspect, setShowAddProspect] = useState(false)
  const [addProspectForm, setAddProspectForm] = useState({ name: '', email: '', handle: '' })
  const [addProspectSubmitting, setAddProspectSubmitting] = useState(false)

  const loadProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects/influencers', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setProspects(data.prospects || [])
      }
    } catch (err) {
      console.error('Error loading prospects:', err)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status !== 'authenticated') return

    const loadData = async () => {
      try {
        const [analyticsRes, dealsRes] = await Promise.all([
          fetch('/api/analytics/brand', { credentials: 'include' }),
          fetch('/api/rifts/list?limit=20', { credentials: 'include' }),
        ])
        if (analyticsRes.ok) {
          const data = await analyticsRes.json()
          setAnalytics(data)
        }
        if (dealsRes.ok) {
          const text = await dealsRes.text()
          if (text && text.trim().length > 0) {
            const data = JSON.parse(text)
            setDeals(data.data || data.rifts || [])
          }
        }
        await loadProspects()
      } catch (err) {
        console.error('Error loading brand data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [status, router, loadProspects])

  const activeDeals = useMemo(() => {
    const terminal = ['RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'CANCELED', 'CANCELLED', 'REFUNDED']
    return deals.filter(d => !terminal.includes(d.status))
  }, [deals])

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FUNDED': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'PROOF_SUBMITTED': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'RELEASED': case 'PAID_OUT': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'DISPUTED': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addProspectForm.name && !addProspectForm.email && !addProspectForm.handle) return
    setAddProspectSubmitting(true)
    try {
      const res = await fetch('/api/prospects/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(addProspectForm),
      })
      if (res.ok) {
        setAddProspectForm({ name: '', email: '', handle: '' })
        setShowAddProspect(false)
        await loadProspects()
      }
    } catch (err) {
      console.error('Error adding prospect:', err)
    } finally {
      setAddProspectSubmitting(false)
    }
  }

  const handleUpdateProspectStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/prospects/influencers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await loadProspects()
    } catch (err) {
      console.error('Error updating prospect:', err)
    }
  }

  const handleDeleteProspect = async (id: string) => {
    if (!confirm('Remove this prospect?')) return
    try {
      const res = await fetch(`/api/prospects/influencers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) await loadProspects()
    } catch (err) {
      console.error('Error deleting prospect:', err)
    }
  }

  const prospectList = prospects.filter(p => p.status === 'PENDING')
  const influencerList = prospects.filter(p => p.status === 'WORKING')

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
            Brand Hub
          </h1>
          <p className="mt-1 text-[#86868b] text-sm">
            Manage campaigns, track spend, and find the right creators.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/brand/discover"
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-[#1d1d1f] hover:bg-gray-50 transition-all"
          >
            Discover Creators
          </Link>
          <Link
            href="/rifts/new"
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >
            New Campaign
          </Link>
        </div>
      </div>

      {/* Spend Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl font-semibold text-blue-600 tracking-tight">
            {formatCurrency(analytics?.totalSpent ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Active Budget</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            {formatCurrency(analytics?.activeBudget ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            {formatCurrency(analytics?.thisMonthSpent ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{analytics?.totalInfluencers ?? 0}</p>
          <p className="text-xs text-[#86868b] mt-1">Total Influencers</p>
        </GlassCard>
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{analytics?.activeDeals ?? activeDeals.length}</p>
          <p className="text-xs text-[#86868b] mt-1">Active Deals</p>
        </GlassCard>
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-blue-600">
            {formatCurrency(analytics?.avgDealCost ?? 0, analytics?.currency)}
          </p>
          <p className="text-xs text-[#86868b] mt-1">Avg Deal Cost</p>
        </GlassCard>
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{deals.length}</p>
          <p className="text-xs text-[#86868b] mt-1">Total Deals</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Influencers */}
        <GlassCard className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">Top Influencers</h2>
              <Link href="/brand/discover" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Discover More
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {(!analytics?.topInfluencers || analytics.topInfluencers.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-[#86868b] text-sm">No influencers yet. Start a campaign to get going.</p>
              </div>
            ) : (
              analytics.topInfluencers.slice(0, 5).map((inf, idx) => (
                <div key={inf.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-semibold text-blue-600">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">{inf.name}</p>
                      <p className="text-xs text-[#86868b]">{inf.dealCount} deal{inf.dealCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-[#1d1d1f]">
                    {formatCurrency(inf.totalSpent, analytics.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Active Campaigns */}
        <GlassCard className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">Active Campaigns</h2>
              <Link href="/rifts" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View All
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {activeDeals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#86868b] text-sm">No active campaigns.</p>
              </div>
            ) : (
              activeDeals.slice(0, 5).map(deal => (
                <Link key={deal.id} href={`/rifts/${deal.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1d1d1f] truncate">{deal.itemTitle}</p>
                      <p className="text-xs text-[#86868b] mt-0.5">
                        {deal.seller?.name || deal.seller?.email?.split('@')[0] || 'Unknown'} &middot; Rift #{deal.riftNumber ?? deal.id.slice(-4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(deal.status)}`}>
                        {deal.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-[#1d1d1f]">
                        {formatCurrency(deal.amount, deal.currency)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Prospects & Influencers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prospects (prospective influencers) */}
        <GlassCard className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">Prospects</h2>
              <button
                type="button"
                onClick={() => setShowAddProspect(!showAddProspect)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showAddProspect ? 'Cancel' : '+ Add Prospect'}
              </button>
            </div>
          </div>
          {showAddProspect && (
            <form onSubmit={handleAddProspect} className="p-4 border-b border-gray-100 space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={addProspectForm.name}
                onChange={e => setAddProspectForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={addProspectForm.email}
                onChange={e => setAddProspectForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Handle (e.g. @creator)"
                value={addProspectForm.handle}
                onChange={e => setAddProspectForm(f => ({ ...f, handle: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={addProspectSubmitting || (!addProspectForm.name && !addProspectForm.email && !addProspectForm.handle)}
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )}
          <div className="divide-y divide-gray-100">
            {prospectList.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#86868b] text-sm">No prospective influencers yet. Add creators you're interested in working with.</p>
              </div>
            ) : (
              prospectList.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">{p.name || p.handle || p.email || 'Unknown'}</p>
                    <p className="text-xs text-[#86868b]">{[p.handle, p.email].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateProspectStatus(p.id, 'WORKING')}
                      className="text-xs px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      Mark Working
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProspect(p.id)}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Influencers (confirmed working) */}
        <GlassCard className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">Influencers</h2>
            <p className="text-xs text-[#86868b] mt-1">Creators you're actively working with</p>
          </div>
          <div className="divide-y divide-gray-100">
            {influencerList.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#86868b] text-sm">No influencers yet. Mark prospects as &quot;Working&quot; when you start a deal.</p>
              </div>
            ) : (
              influencerList.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">{p.name || p.handle || p.email || 'Unknown'}</p>
                    <p className="text-xs text-[#86868b]">{[p.handle, p.email].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateProspectStatus(p.id, 'PENDING')}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Back to Prospect
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProspect(p.id)}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Analytics Link */}
      <div className="flex justify-center pt-2">
        <Link
          href="/brand/analytics"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
        >
          View Detailed Analytics
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
