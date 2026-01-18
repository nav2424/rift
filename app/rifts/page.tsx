'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import StatusPill from '@/components/ui/StatusPill'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton'
import { getItemTypeLabel } from '@/lib/item-type-labels'

interface RiftTransaction {
  id: string
  riftNumber: number | null
  itemTitle: string
  itemType: string
  amount: number
  currency: string
  status: string
  buyerId: string
  sellerId: string
  createdAt: string
  buyer: {
    id: string
    name: string | null
    email: string
  }
  seller: {
    id: string
    name: string | null
    email: string
  }
}

type RiftFilter = 'all' | 'active' | 'completed' | 'cancelled' | 'archived'

export default function AllRiftsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<RiftFilter>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  // Sync search query with URL params
  useEffect(() => {
    const searchParam = searchParams.get('search') || ''
    setSearchQuery(searchParam)
  }, [searchParams])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadRifts(1)
    }
  }, [status, router])

  // Reload rifts when filter or search query changes
  useEffect(() => {
    if (status === 'authenticated') {
      loadRifts(1)
    }
  }, [filter, searchQuery, status])

  const loadRifts = async (pageNum: number = 1, append: boolean = false) => {
    try {
      setLoading(true)
      // Build query params with server-side filtering
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      })
      
      // Add filter if not 'all'
      if (filter !== 'all') {
        if (filter === 'active') {
          params.append('status', 'active')
        } else if (filter === 'completed') {
          params.append('status', 'completed')
        } else if (filter === 'cancelled') {
          params.append('status', 'cancelled')
        } else if (filter === 'archived') {
          params.append('archived', 'true')
        }
      }
      
      // Add search query if provided
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }
      
      const response = await fetch(`/api/rifts/list?${params}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        // Handle paginated format
        if (data.pagination) {
          const items = data.data || []
          if (append) {
            setRifts(prev => [...prev, ...items])
          } else {
            setRifts(items)
          }
          setHasMore(data.pagination.hasMore || false)
          setTotal(data.pagination.total || 0)
        } else {
          // Fallback to old format
          const items = data.rifts || data.data || []
          setRifts(append ? [...rifts, ...items] : items)
          setHasMore(false)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('API error response:', response.status, errorData)
        showToast(errorData.details || 'Failed to load rifts. Please try again.', 'error')
      }
    } catch (error) {
      console.error('Error loading rifts:', error)
      showToast('Failed to load rifts. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadRifts(nextPage, true)
  }

  // Filtering is now done server-side, but we also apply client-side search for better UX
  const filteredRifts = useMemo(() => {
    let filtered = [...rifts]
    
    // Apply search query client-side as well for immediate feedback
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(rift => {
        const riftNumber = rift.riftNumber?.toString() || rift.id.slice(-4)
        const itemTitle = rift.itemTitle?.toLowerCase() || ''
        const buyerName = (rift.buyer.name || rift.buyer.email || '').toLowerCase()
        const sellerName = (rift.seller.name || rift.seller.email || '').toLowerCase()
        
        return (
          riftNumber.includes(query) ||
          itemTitle.includes(query) ||
          buyerName.includes(query) ||
          sellerName.includes(query)
        )
      })
    }
    
    return filtered
  }, [rifts, searchQuery])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED': return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' }
      case 'REFUNDED': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
      case 'DISPUTED': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' }
      case 'CANCELLED': return { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' }
      case 'FUNDED': return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
      case 'AWAITING_PAYMENT': return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
      case 'AWAITING_SHIPMENT': return { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' }
      case 'IN_TRANSIT': return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' }
      case 'DELIVERED_PENDING_RELEASE': return { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' }
      case 'PROOF_SUBMITTED': return { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' }
      case 'UNDER_REVIEW': return { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' }
      default: return { text: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' }
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'FUNDED': return 'Paid'
      case 'AWAITING_PAYMENT': return 'Awaiting Payment'
      case 'AWAITING_SHIPMENT': return 'Awaiting Shipment'
      case 'IN_TRANSIT': return 'In Transit'
      case 'DELIVERED_PENDING_RELEASE': return 'Pending Release'
      case 'RELEASED': return 'Released'
      case 'REFUNDED': return 'Refunded'
      case 'DISPUTED': return 'Disputed'
      case 'CANCELLED': return 'Cancelled'
      default: return status.replace(/_/g, ' ')
    }
  }

  if (status === 'loading' || (loading && rifts.length === 0)) {
    return (
      <div className="space-y-8">
        <div className="mb-8">
          <Skeleton variant="rectangular" width={200} height={40} className="mb-4" />
          <Skeleton variant="text" width={300} height={24} />
        </div>
        <div className="mb-6 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" width={80} height={36} className="rounded-xl" />
          ))}
        </div>
        <SkeletonList count={5} />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 md:mb-10 pb-4 sm:pb-6 border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/10 flex items-center justify-center border border-cyan-500/20 shadow-lg shadow-cyan-500/10 flex-shrink-0">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-white tracking-tight mb-1 truncate">
                  Your Rifts
                </h1>
                <p className="text-white/50 font-light text-xs sm:text-sm">All your brand deals and creator partnerships</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-shrink-0">
              <Link 
                href="/api/rifts/export"
                className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/20 text-white/80 font-light flex items-center gap-1.5 sm:gap-2 group min-h-[44px] text-xs sm:text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Link>
              <Link 
                href="/rifts/new"
                className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/20 text-white font-light flex items-center gap-1.5 sm:gap-2 group min-h-[44px] text-xs sm:text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Create Rift</span>
                <span className="sm:hidden">New</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 sm:mb-8 space-y-4 sm:space-y-5">
          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {(['all', 'active', 'completed', 'cancelled', 'archived'] as RiftFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-light transition-all duration-200 min-h-[44px] flex items-center justify-center ${
                  filter === f
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/8 hover:border-white/20'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by Rift number, item title, or user..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value
                setSearchQuery(value)
                // Update URL params to sync with AppLayout search bar
                const params = new URLSearchParams(searchParams.toString())
                if (value.trim()) {
                  params.set('search', value.trim())
                } else {
                  params.delete('search')
                }
                const newUrl = params.toString() ? `/rifts?${params.toString()}` : '/rifts'
                router.push(newUrl, { scroll: false })
              }}
              className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-cyan-500/30 focus:bg-white/8 transition-all duration-200 text-sm sm:text-base min-h-[44px]"
            />
          </div>
        </div>

        {/* Rifts List */}
        {!loading && filteredRifts.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            title={filter === 'archived' ? 'No archived rifts' : 'No rifts found'}
            description={searchQuery 
              ? 'Try a different search query' 
              : filter === 'all' 
                ? 'You don\'t have any transactions yet'
                : filter === 'archived'
                  ? 'You haven\'t archived any rifts yet'
                  : `No ${filter} rifts at the moment`}
            action={filter === 'all' ? {
              label: 'Create a Rift',
              href: '/rifts/new'
            } : undefined}
          />
        ) : (
          <div className="space-y-6">
            {filteredRifts.map((rift) => {
              const isBuyer = rift.buyerId === session?.user?.id
              const role = isBuyer ? 'Buyer' : 'Seller'
              const otherParty = isBuyer ? rift.seller : rift.buyer

              return (
                <Link key={rift.id} href={`/rifts/${rift.id}`}>
                  <GlassCard className="hover:bg-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer group">
                    <div className="p-4 sm:p-5 md:p-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 sm:gap-4 mb-2 sm:mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-light text-base sm:text-lg mb-1 truncate">
                                Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                              </h3>
                              <p className="text-white/80 font-light leading-relaxed text-sm sm:text-base line-clamp-2">{rift.itemTitle}</p>
                            </div>
                            <span className="text-white/40 font-light text-xs whitespace-nowrap flex-shrink-0 pt-1">
                              {new Date(rift.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
                            <StatusPill status={rift.status} />
                            <span className="text-white/60 font-light text-xs sm:text-sm">
                              {getItemTypeLabel(rift.itemType)}
                            </span>
                            <span className="text-white/40 hidden sm:inline">•</span>
                            <span className="text-white/60 font-light text-xs sm:text-sm">{role}</span>
                            <span className="text-white/40 hidden sm:inline">•</span>
                            <span className="text-white/60 font-light text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                              {otherParty.name || otherParty.email.split('@')[0]}
                            </span>
                            <span className="text-white/70 font-light text-sm sm:text-base font-mono ml-auto flex-shrink-0">
                              {formatCurrency(rift.amount, rift.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              )
            })}
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-white font-light min-h-[44px] text-sm sm:text-base"
            >
              Load More
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && rifts.length > 0 && (
          <div className="mt-6 text-center text-white/60 font-light">
            Loading...
          </div>
        )}
      </div>
  )
}

