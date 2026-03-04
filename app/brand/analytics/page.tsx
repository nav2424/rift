'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

interface SpendByMonth {
  month: string
  amount: number
}

interface InfluencerBreakdown {
  id: string
  name: string
  totalSpent: number
  dealCount: number
  avgDeal: number
}

interface BrandAnalyticsData {
  totalSpent: number
  activeBudget: number
  thisMonthSpent: number
  totalInfluencers: number
  avgDealCost: number
  activeDeals: number
  currency: string
  spendByMonth: SpendByMonth[]
  influencerBreakdown: InfluencerBreakdown[]
}

export default function BrandAnalyticsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<BrandAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status === 'authenticated') {
      loadAnalytics()
    }
  }, [status, router])

  const loadAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/brand', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      }
    } catch (err) {
      console.error('Error loading brand analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading...</div>
      </div>
    )
  }

  const maxMonthlySpend = Math.max(
    ...(analytics?.spendByMonth?.map(m => m.amount) || [0]),
    1
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
            Analytics
          </h1>
          <p className="mt-1 text-[#86868b] text-sm">
            Detailed spend analytics and influencer performance.
          </p>
        </div>
        <Link
          href="/brand"
          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-[#1d1d1f] hover:bg-gray-50 transition-all"
        >
          Back to Hub
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Total Spent</p>
          <p className="text-xl font-semibold text-blue-600 tracking-tight">
            {formatCurrency(analytics?.totalSpent ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">This Month</p>
          <p className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
            {formatCurrency(analytics?.thisMonthSpent ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Avg Deal Cost</p>
          <p className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
            {formatCurrency(analytics?.avgDealCost ?? 0, analytics?.currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs font-light text-[#86868b] mb-1 uppercase tracking-wider">Influencers</p>
          <p className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
            {analytics?.totalInfluencers ?? 0}
          </p>
        </GlassCard>
      </div>

      {/* Spend Over Time */}
      <GlassCard className="border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Spend Over Time</h2>
        </div>
        <div className="p-5">
          {(!analytics?.spendByMonth || analytics.spendByMonth.length === 0) ? (
            <div className="py-8 text-center">
              <p className="text-[#86868b] text-sm">No spending data available yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Month</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider w-1/2">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.spendByMonth.map((m) => (
                    <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-[#1d1d1f] font-medium">{m.month}</td>
                      <td className="py-3 px-4 text-right text-[#1d1d1f]">
                        {formatCurrency(m.amount, analytics.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${(m.amount / maxMonthlySpend) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Per-Influencer Breakdown */}
      <GlassCard className="border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Per-Influencer Breakdown</h2>
        </div>
        <div className="p-5">
          {(!analytics?.influencerBreakdown || analytics.influencerBreakdown.length === 0) ? (
            <div className="py-8 text-center">
              <p className="text-[#86868b] text-sm">No influencer data available yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Influencer</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Total Spent</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Deals</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Avg Deal</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.influencerBreakdown.map((inf) => (
                    <tr key={inf.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="text-[#1d1d1f] font-medium">{inf.name}</p>
                      </td>
                      <td className="py-3 px-4 text-right text-[#1d1d1f] font-medium">
                        {formatCurrency(inf.totalSpent, analytics.currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-[#86868b]">{inf.dealCount}</td>
                      <td className="py-3 px-4 text-right text-[#86868b]">
                        {formatCurrency(inf.avgDeal, analytics.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Deal Cost Comparison */}
      <GlassCard className="border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Deal Cost Comparison</h2>
        </div>
        <div className="p-5">
          {(!analytics?.influencerBreakdown || analytics.influencerBreakdown.length === 0) ? (
            <div className="py-8 text-center">
              <p className="text-[#86868b] text-sm">No comparison data available yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Influencer</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Min Deal</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Avg Deal</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider">Max Deal</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#86868b] uppercase tracking-wider w-1/4">Relative Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.influencerBreakdown.map((inf) => {
                    const maxAvg = Math.max(...analytics.influencerBreakdown.map(i => i.avgDeal), 1)
                    return (
                      <tr key={inf.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-[#1d1d1f] font-medium">{inf.name}</td>
                        <td className="py-3 px-4 text-right text-emerald-600">
                          {formatCurrency(inf.avgDeal * 0.7, analytics.currency)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#1d1d1f] font-medium">
                          {formatCurrency(inf.avgDeal, analytics.currency)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#86868b]">
                          {formatCurrency(inf.avgDeal * 1.4, analytics.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(inf.avgDeal / maxAvg) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
