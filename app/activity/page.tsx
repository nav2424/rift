'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

interface EscrowTransaction {
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

type ActivityFilter = 'all' | 'active' | 'completed' | 'pending' | 'cancelled'

export default function ActivityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<ActivityFilter>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadEscrows()
    }
  }, [status, router])

  const loadEscrows = async () => {
    try {
      const response = await fetch('/api/escrows/list', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setEscrows(data.escrows || [])
      }
    } catch (error) {
      console.error('Error loading escrows:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAllActivity = useMemo(() => {
    let filtered = [...escrows]

    // Apply status filter
    if (filter === 'active') {
      filtered = filtered.filter(e => 
        ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
      )
    } else if (filter === 'completed') {
      filtered = filtered.filter(e => e.status === 'RELEASED')
    } else if (filter === 'pending') {
      filtered = filtered.filter(e => {
        if (e.buyerId === session?.user?.id) {
          return e.status === 'AWAITING_PAYMENT'
        } else {
          return e.status === 'AWAITING_SHIPMENT' || e.status === 'DELIVERED_PENDING_RELEASE'
        }
      })
    } else if (filter === 'cancelled') {
      filtered = filtered.filter(e => e.status === 'CANCELLED' || e.status === 'REFUNDED')
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(escrow => {
        const riftNumber = escrow.riftNumber?.toString() || escrow.id.slice(-4)
        const itemTitle = escrow.itemTitle?.toLowerCase() || ''
        const buyerName = (escrow.buyer.name || escrow.buyer.email || '').toLowerCase()
        const sellerName = (escrow.seller.name || escrow.seller.email || '').toLowerCase()
        
        return (
          riftNumber.includes(query) ||
          itemTitle.includes(query) ||
          buyerName.includes(query) ||
          sellerName.includes(query)
        )
      })
    }

    // Sort by date (most recent first)
    const sorted = filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Map to activity format
    return sorted.map(escrow => {
      const isBuyer = escrow.buyerId === session?.user?.id
      const otherParty = isBuyer ? escrow.seller : escrow.buyer
      const name = otherParty.name || otherParty.email.split('@')[0]

      const riftNumber = escrow.riftNumber ?? escrow.id.slice(-4)
      let message = ''
      switch (escrow.status) {
        case 'AWAITING_PAYMENT':
          message = isBuyer 
            ? `Rift #${riftNumber} — You created a rift with ${name} — awaiting payment`
            : `Rift #${riftNumber} — ${name} created a rift — awaiting payment`
          break
        case 'AWAITING_SHIPMENT':
          message = isBuyer
            ? `Rift #${riftNumber} — Payment received — awaiting shipment`
            : `Rift #${riftNumber} — Payment received — upload proof of shipment`
          break
        case 'IN_TRANSIT':
          message = `Rift #${riftNumber} — Shipment in transit`
          break
        case 'DELIVERED_PENDING_RELEASE':
          message = isBuyer
            ? `Rift #${riftNumber} — Shipment delivered — waiting for your confirmation`
            : `Rift #${riftNumber} — Shipment delivered — waiting for buyer confirmation`
          break
        case 'RELEASED':
          message = `Rift #${riftNumber} — Funds released — transaction completed`
          break
        default:
          message = `Rift #${riftNumber} — ${escrow.status.replace(/_/g, ' ').toLowerCase()}`
      }

      return { ...escrow, message, name }
    })
  }, [escrows, filter, searchQuery, session?.user?.id])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED': return 'text-green-400'
      case 'REFUNDED': return 'text-red-400'
      case 'DISPUTED': return 'text-yellow-400'
      case 'CANCELLED': return 'text-gray-400'
      case 'AWAITING_PAYMENT': return 'text-blue-400'
      case 'AWAITING_SHIPMENT': return 'text-purple-400'
      case 'IN_TRANSIT': return 'text-cyan-400'
      case 'DELIVERED_PENDING_RELEASE': return 'text-teal-400'
      default: return 'text-white/60'
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

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-4 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center border border-cyan-500/20 flex-shrink-0 self-center">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-5xl md:text-6xl font-light text-white tracking-tight">
              Recent Activity
            </h1>
          </div>
          <p className="text-white/60 font-light ml-16">All your transaction activity</p>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'completed', 'pending', 'cancelled'] as ActivityFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-light transition-colors ${
                  filter === f
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/8'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search by Rift number, item title, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {/* Activity List */}
        {getAllActivity.length === 0 ? (
          <GlassCard>
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-white mb-2">No activity found</h3>
              <p className="text-white/60 font-light text-sm">
                {searchQuery ? 'Try a different search query' : 'You don\'t have any transactions yet'}
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {getAllActivity.map((activity) => (
              <Link key={activity.id} href={`/escrows/${activity.id}`}>
                <GlassCard className="hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white font-light mb-2">{activity.message}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`text-sm font-light ${getStatusColor(activity.status)}`}>
                            {activity.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-white/40 font-light text-sm">
                            {formatCurrency(activity.amount, activity.currency)}
                          </span>
                        </div>
                      </div>
                      <span className="text-white/40 font-light text-xs whitespace-nowrap">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

