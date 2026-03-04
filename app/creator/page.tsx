'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

interface CreatorAnalytics {
  totalEarned: number
  pendingAmount: number
  thisMonthEarned: number
  totalDeals: number
  completedDeals: number
  avgDealValue: number
  currency: string
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

export default function CreatorHubPage() {
  const { status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status !== 'authenticated') return

    const loadData = async () => {
      try {
        const [analyticsRes, dealsRes] = await Promise.all([
          fetch('/api/analytics/creator', { credentials: 'include' }),
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
      } catch (err) {
        console.error('Error loading creator data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [status, router])

  const activeDeals = useMemo(() => {
    const terminal = ['RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'CANCELED', 'CANCELLED', 'REFUNDED']
    return deals.filter(d => !terminal.includes(d.status))
  }, [deals])

  const completionRate = useMemo(() => {
    if (deals.length === 0) return 0
    const completed = deals.filter(d => ['RELEASED', 'PAID_OUT'].includes(d.status)).length
    return Math.round((completed / deals.length) * 100)
  }, [deals])

  const recentActivity = useMemo(() => {
    return [...deals]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
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
            Creator Hub
          </h1>
          <p className="mt-1 text-[#86868b] text-sm">
            Manage your deals, track earnings, and grow your creator business.
          </p>
        </div>
        <Link
          href="/rifts/new"
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
        >
          New Deal
        </Link>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Total Earned</p>
          <p className="text-2xl font-semibold text-emerald-600 tracking-tight">
            {formatCurrency(analytics?.totalEarned ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            {formatCurrency(analytics?.pendingAmount ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
            {formatCurrency(analytics?.thisMonthEarned ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{deals.length}</p>
          <p className="text-xs text-[#86868b] mt-1">Total Deals</p>
        </GlassCard>
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">{activeDeals.length}</p>
          <p className="text-xs text-[#86868b] mt-1">Active Deals</p>
        </GlassCard>
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-emerald-600">{completionRate}%</p>
          <p className="text-xs text-[#86868b] mt-1">Completion Rate</p>
        </GlassCard>
        <GlassCard className="p-4 border border-gray-200 bg-white text-center">
          <p className="text-2xl font-semibold text-[#1d1d1f]">
            {formatCurrency(analytics?.avgDealValue ?? 0, analytics?.currency)}
          </p>
          <p className="text-xs text-[#86868b] mt-1">Avg Deal Value</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Deals */}
        <GlassCard className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">Active Deals</h2>
              <Link href="/rifts" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                View All
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {activeDeals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#86868b] text-sm">No active deals right now.</p>
              </div>
            ) : (
              activeDeals.slice(0, 5).map(deal => (
                <Link key={deal.id} href={`/rifts/${deal.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1d1d1f] truncate">{deal.itemTitle}</p>
                      <p className="text-xs text-[#86868b] mt-0.5">
                        {deal.buyer?.name || deal.buyer?.email?.split('@')[0] || 'Unknown'} &middot; Rift #{deal.riftNumber ?? deal.id.slice(-4)}
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

        {/* Recent Activity */}
        <GlassCard className="border border-gray-200 bg-white">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#86868b] text-sm">No activity yet.</p>
              </div>
            ) : (
              recentActivity.map(deal => (
                <Link key={deal.id} href={`/rifts/${deal.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#1d1d1f]">{deal.itemTitle}</p>
                      <p className="text-xs text-[#86868b] mt-0.5">
                        {new Date(deal.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(deal.status)} flex-shrink-0 ml-3`}>
                      {deal.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
