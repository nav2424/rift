'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { useToast } from '@/components/ui/Toast'

interface RiftTransaction {
  id: string
  riftNumber: number | null
  itemTitle: string
  itemType: string
  amount: number
  subtotal?: number | null
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

type ActivityFilter = 'all' | 'active' | 'completed' | 'pending' | 'cancelled'

interface ActivityRecord {
  id: string
  type: string
  summary: string
  status?: string
  amount: number | null
  currency?: string
  createdAt: string
  metadata?: Record<string, any>
  message?: string
}

export default function ActivityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<ActivityFilter>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
  }, [status, router])

  const loadActivities = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/activity?limit=200', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      } else {
        showToast('Failed to load activity. Please try again.', 'error')
      }
    } catch (error) {
      console.error('Error loading activities:', error)
      showToast('Failed to load activity. Please check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadRifts = async (pageNum: number = 1) => {
    try {
      // Build query params with server-side filtering
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50',
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
        const items = data.data || []
        setRifts(items)
      }
    } catch (error) {
      console.error('Error loading rifts:', error)
    }
  }
  
  useEffect(() => {
    if (status === 'authenticated') {
      loadActivities()
      loadRifts(1)
    }
  }, [filter, searchQuery, status])

  const getAllActivity = useMemo(() => {
    // Combine activities and rifts for comprehensive activity feed
    const allActivityItems: Array<{
      id: string
      type: string
      message: string
      status?: string
      amount?: number | null
      currency?: string
      createdAt: string
      metadata?: any
    }> = []

    // Add activities from Activity model
    activities.forEach(activity => {
      allActivityItems.push({
        id: activity.id,
        type: activity.type,
        message: activity.summary,
        amount: activity.amount,
        createdAt: activity.createdAt,
        metadata: activity.metadata,
      })
    })

    // Add rifts as activity items (for backward compatibility and comprehensive view)
    rifts.forEach(rift => {
      const isBuyer = rift.buyerId === session?.user?.id
      const otherParty = isBuyer ? rift.seller : rift.buyer
      const name = otherParty.name || otherParty.email.split('@')[0]
      
      // Only include rifts that match the filter
      let include = true
      if (filter === 'active') {
        include = ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE', 'FUNDED', 'PROOF_SUBMITTED'].includes(rift.status)
      } else if (filter === 'completed') {
        include = rift.status === 'RELEASED' || rift.status === 'PAID_OUT'
      } else if (filter === 'pending') {
        include = (isBuyer && rift.status === 'AWAITING_PAYMENT') || (!isBuyer && (rift.status === 'AWAITING_SHIPMENT' || rift.status === 'DELIVERED_PENDING_RELEASE'))
      } else if (filter === 'cancelled') {
        include = rift.status === 'CANCELLED' || rift.status === 'REFUNDED'
      }

      if (include) {
        const query = searchQuery.toLowerCase().trim()
        const riftNumber = rift.riftNumber?.toString() || rift.id.slice(-4)
        const itemTitle = rift.itemTitle?.toLowerCase() || ''
        const buyerName = (rift.buyer.name || rift.buyer.email || '').toLowerCase()
        const sellerName = (rift.seller.name || rift.seller.email || '').toLowerCase()
        
        // Apply search query
        if (!searchQuery.trim() || 
            riftNumber.includes(query) ||
            itemTitle.includes(query) ||
            buyerName.includes(query) ||
            sellerName.includes(query)) {
          
          const riftMessage = isBuyer
            ? `Rift #${riftNumber} — ${name} — ${rift.status === 'AWAITING_PAYMENT' ? 'awaiting payment' : rift.status.replace(/_/g, ' ').toLowerCase()}`
            : `Rift #${riftNumber} — ${name} — ${rift.status === 'AWAITING_SHIPMENT' ? 'awaiting shipment' : rift.status.replace(/_/g, ' ').toLowerCase()}`
          
          allActivityItems.push({
            id: rift.id,
            type: 'RIFT',
            message: riftMessage,
            status: rift.status,
            amount: rift.subtotal || rift.amount,
            currency: rift.currency,
            createdAt: rift.createdAt,
            metadata: { riftId: rift.id, riftNumber: rift.riftNumber },
          })
        }
      }
    })

    // Sort by date (most recent first)
    const sorted = allActivityItems.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return sorted
  }, [activities, rifts, filter, searchQuery, session?.user?.id])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status?: string) => {
    if (!status) {
      return { text: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' }
    }
    switch (status) {
      case 'RELEASED': return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' }
      case 'REFUNDED': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
      case 'DISPUTED': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' }
      case 'CANCELLED': return { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' }
      case 'AWAITING_PAYMENT': return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
      case 'AWAITING_SHIPMENT': return { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' }
      case 'IN_TRANSIT': return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' }
      case 'DELIVERED_PENDING_RELEASE': return { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' }
      case 'FUNDED': return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
      default: return { text: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' }
    }
  }

  const getStatusIcon = (status?: string) => {
    if (!status) return null
    switch (status) {
      case 'RELEASED':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'REFUNDED':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'DISPUTED':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'AWAITING_PAYMENT':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'AWAITING_SHIPMENT':
      case 'IN_TRANSIT':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        )
      case 'DELIVERED_PENDING_RELEASE':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'FUNDED':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-1">
                Recent Activity
              </h1>
              <p className="text-white/50 font-light text-sm">All your transaction activity</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-5">
          <div className="flex flex-wrap gap-2.5">
            {(['all', 'active', 'completed', 'pending', 'cancelled'] as ActivityFilter[]).map((f) => (
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

        {/* Activity List */}
        {getAllActivity.length === 0 ? (
          <GlassCard variant="strong" className="overflow-hidden">
            <div className="p-16 text-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
                <svg className="w-12 h-12 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-light text-white mb-3">No activity found</h3>
              <p className="text-white/50 font-light">
                {searchQuery ? 'Try a different search query' : 'You don\'t have any transactions yet'}
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {getAllActivity.map((activity) => {
              const statusColors = getStatusColor(activity.status)
              return (
                <Link key={activity.id} href={`/rifts/${activity.id}`}>
                  <GlassCard className="hover:bg-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer group">
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <p className="text-white font-light leading-relaxed text-base">{activity.message}</p>
                            <span className="text-white/40 font-light text-xs whitespace-nowrap flex-shrink-0 pt-1">
                              {new Date(activity.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light border ${statusColors.bg} ${statusColors.border} ${statusColors.text}`}>
                              {getStatusIcon(activity.status)}
                              {activity.status ? (activity.status === 'FUNDED' ? 'Paid' : activity.status.replace(/_/g, ' ')) : 'Active'}
                            </span>
                            {activity.amount !== null && activity.amount !== undefined && (
                              <span className="text-white/70 font-light text-sm font-mono">
                                {formatCurrency(activity.amount, activity.currency || 'CAD')}
                              </span>
                            )}
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
      </div>
    </div>
  )
}

