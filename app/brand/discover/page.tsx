'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

const NICHES = [
  '', 'LIFESTYLE', 'FASHION', 'BEAUTY', 'FITNESS', 'FOOD', 'TRAVEL',
  'TECH', 'GAMING', 'FINANCE', 'EDUCATION', 'ENTERTAINMENT', 'MUSIC',
  'SPORTS', 'HEALTH', 'PARENTING', 'PETS', 'HOME', 'AUTO', 'OTHER',
] as const

const SORT_OPTIONS = [
  { value: 'followers', label: 'Followers' },
  { value: 'engagementRate', label: 'Engagement' },
  { value: 'postRate', label: 'Rate' },
] as const

interface Creator {
  id: string
  displayName: string
  handle: string | null
  platform: string
  niche: string
  followers: number
  engagementRate: number
  postRate: number | null
  videoRate: number | null
  currency: string
  bio: string | null
  verified: boolean
  userId: string
}

export default function DiscoverCreatorsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    niche: '',
    minFollowers: '',
    maxRate: '',
    sort: 'followers',
    search: '',
  })

  const loadCreators = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.niche) params.set('niche', filters.niche)
      if (filters.minFollowers) params.set('minFollowers', filters.minFollowers)
      if (filters.maxRate) params.set('maxRate', filters.maxRate)
      if (filters.sort) params.set('sort', filters.sort)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/creators/discover?${params.toString()}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCreators(data.creators || data || [])
      }
    } catch (err) {
      console.error('Error loading creators:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status === 'authenticated') {
      loadCreators()
    }
  }, [status, router, loadCreators])

  const updateFilter = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (amount: number | null, currency: string = 'CAD') => {
    if (amount == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const selectClass =
    'p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-[#1d1d1f] focus:outline-none focus:border-gray-300 transition-colors'
  const inputClass =
    'p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 transition-colors'

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
          Discover Creators
        </h1>
        <p className="mt-1 text-[#86868b] text-sm">
          Find the right influencers for your brand campaigns.
        </p>
      </div>

      {/* Filters */}
      <GlassCard className="p-4 sm:p-5 border border-gray-200 bg-white">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-[#86868b] mb-1.5">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              placeholder="Name or handle..."
              className={`w-full ${inputClass}`}
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-[#86868b] mb-1.5">Niche</label>
            <select
              value={filters.niche}
              onChange={e => updateFilter('niche', e.target.value)}
              className={`w-full ${selectClass}`}
            >
              <option value="">All Niches</option>
              {NICHES.filter(Boolean).map(n => (
                <option key={n} value={n}>
                  {n.charAt(0) + n.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-[#86868b] mb-1.5">Min Followers</label>
            <input
              type="number"
              value={filters.minFollowers}
              onChange={e => updateFilter('minFollowers', e.target.value)}
              placeholder="1000"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-[#86868b] mb-1.5">Max Rate</label>
            <input
              type="number"
              value={filters.maxRate}
              onChange={e => updateFilter('maxRate', e.target.value)}
              placeholder="500"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-[#86868b] mb-1.5">Sort By</label>
            <select
              value={filters.sort}
              onChange={e => updateFilter('sort', e.target.value)}
              className={`w-full ${selectClass}`}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse border border-gray-200" />
          ))}
        </div>
      ) : creators.length === 0 ? (
        <GlassCard className="p-12 border border-gray-200 bg-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">No creators found</h3>
          <p className="text-sm text-[#86868b]">Try adjusting your filters to see more results.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creators.map(creator => (
            <Link key={creator.id} href={`/account/${creator.userId}`}>
              <GlassCard
                hover
                className="p-5 border border-gray-200 bg-white hover:border-blue-200 hover:shadow-md transition-all h-full"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-[#1d1d1f] truncate">
                        {creator.displayName}
                      </h3>
                      {creator.verified && (
                        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    {creator.handle && (
                      <p className="text-xs text-[#86868b] mt-0.5">
                        @{creator.handle} &middot; {creator.platform}
                      </p>
                    )}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[#86868b] flex-shrink-0">
                    {creator.niche.charAt(0) + creator.niche.slice(1).toLowerCase()}
                  </span>
                </div>

                {creator.bio && (
                  <p className="text-xs text-[#86868b] line-clamp-2 mb-4 leading-relaxed">{creator.bio}</p>
                )}

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#1d1d1f]">{formatNumber(creator.followers)}</p>
                    <p className="text-xs text-[#86868b]">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-emerald-600">{creator.engagementRate.toFixed(1)}%</p>
                    <p className="text-xs text-[#86868b]">Engagement</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-blue-600">
                      {formatCurrency(creator.postRate, creator.currency)}
                    </p>
                    <p className="text-xs text-[#86868b]">Per Post</p>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
