'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { useToast } from '@/components/ui/Toast'
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton'

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

type RiftFilter = 'all' | 'active' | 'completed' | 'cancelled'

export default function AllRiftsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<RiftFilter>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadRifts(1)
    }
  }, [status, router])

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
        showToast('Failed to load rifts. Please try again.', 'error')
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
      <div className="min-h-screen relative overflow-hidden bg-black">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-20">
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
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="mb-10 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/10 flex items-center justify-center border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
              <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-1">
                Your Rifts
              </h1>
              <p className="text-white/50 font-light text-sm">All your rift transactions</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/api/rifts/export"
                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/20 text-white/80 font-light flex items-center gap-2 group"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export CSV</span>
              </Link>
              <Link 
                href="/rifts/new"
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/20 text-white font-light flex items-center gap-2 group"
              >
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Rift</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-5">
          <div className="flex flex-wrap gap-2.5">
            {(['all', 'active', 'completed', 'cancelled'] as RiftFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 rounded-xl text-sm font-light transition-all duration-200 ${
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
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by Rift number, item title, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-cyan-500/30 focus:bg-white/8 transition-all duration-200"
            />
          </div>
        </div>

        {/* Rifts List */}
        {!loading && filteredRifts.length === 0 ? (
          <GlassCard variant="strong" className="overflow-hidden">
            <div className="p-16 text-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
                <svg className="w-12 h-12 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-2xl font-light text-white mb-3">No rifts found</h3>
              <p className="text-white/50 font-light">
                {searchQuery ? 'Try a different search query' : filter === 'all' 
                  ? 'You don\'t have any transactions yet'
                  : `No ${filter} rifts at the moment`}
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {filteredRifts.map((rift) => {
              const isBuyer = rift.buyerId === session?.user?.id
              const role = isBuyer ? 'Buyer' : 'Seller'
              const otherParty = isBuyer ? rift.seller : rift.buyer

              return (
                <Link key={rift.id} href={`/rifts/${rift.id}`}>
                  <GlassCard className="hover:bg-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer group">
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <h3 className="text-white font-light text-lg mb-1">
                                Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                              </h3>
                              <p className="text-white/80 font-light leading-relaxed">{rift.itemTitle}</p>
                            </div>
                            <span className="text-white/40 font-light text-xs whitespace-nowrap flex-shrink-0 pt-1">
                              {new Date(rift.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light border ${getStatusColor(rift.status).bg} ${getStatusColor(rift.status).border} ${getStatusColor(rift.status).text}`}>
                              {getStatusLabel(rift.status)}
                            </span>
                            <span className="text-white/60 font-light text-sm">
                              {rift.itemType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-white/40">•</span>
                            <span className="text-white/60 font-light text-sm">{role}</span>
                            <span className="text-white/40">•</span>
                            <span className="text-white/60 font-light text-sm">
                              {otherParty.name || otherParty.email.split('@')[0]}
                            </span>
                            <span className="text-white/70 font-light text-sm font-mono ml-auto">
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
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-white font-light"
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
    </div>
  )
}

