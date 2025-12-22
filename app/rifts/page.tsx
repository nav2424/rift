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
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RiftFilter>('all')

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
      const response = await fetch('/api/rifts/list?limit=100', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        // Handle both old format (rifts) and new paginated format (data)
        setRifts(data.data || data.rifts || [])
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

  const filteredEscrows = useMemo(() => {
    if (filter === 'all') return rifts
    if (filter === 'active') {
      return rifts.filter(e => 
        ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
      )
    }
    if (filter === 'completed') {
      return rifts.filter(e => e.status === 'RELEASED')
    }
    if (filter === 'cancelled') {
      return rifts.filter(e => e.status === 'CANCELLED')
    }
    return rifts
  }, [rifts, filter])

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
      case 'RELEASED': return 'text-green-400 border-green-500/30 bg-green-500/10'
      case 'REFUNDED': return 'text-red-400 border-red-500/30 bg-red-500/10'
      case 'DISPUTED': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
      case 'CANCELLED': return 'text-gray-400 border-gray-500/30 bg-gray-500/10'
      case 'AWAITING_PAYMENT': return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      case 'AWAITING_SHIPMENT': return 'text-purple-400 border-purple-500/30 bg-purple-500/10'
      case 'IN_TRANSIT': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
      case 'DELIVERED_PENDING_RELEASE': return 'text-teal-400 border-teal-500/30 bg-teal-500/10'
      default: return 'text-white/60 border-white/20 bg-white/5'
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
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h1 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tight">
                  Your Rifts
                </h1>
                <p className="text-white/60 font-light">All your rift transactions</p>
              </div>
            </div>
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

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['all', 'active', 'completed', 'cancelled'] as RiftFilter[]).map((f) => (
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

        {/* Rifts List */}
        {filteredEscrows.length === 0 ? (
          <GlassCard>
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-white mb-2">No rifts found</h3>
              <p className="text-white/60 font-light text-sm mb-6">
                {filter === 'all' 
                  ? 'You don\'t have any rifts yet. Create your first one to get started!'
                  : `No ${filter} rifts at the moment`}
              </p>
              {filter === 'all' && (
                <Link 
                  href="/rifts/new"
                  className="inline-block px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-white font-light"
                >
                  Create Rift
                </Link>
              )}
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {filteredEscrows.map((rift) => {
              const isBuyer = rift.buyerId === session?.user?.id
              const role = isBuyer ? 'Buyer' : 'Seller'
              const otherParty = isBuyer ? rift.seller : rift.buyer

              return (
                <Link key={rift.id} href={`/rifts/${rift.id}`}>
                  <GlassCard className="hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-light text-lg">
                              Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-light border ${getStatusColor(rift.status)}`}>
                              {getStatusLabel(rift.status)}
                            </span>
                          </div>
                          <p className="text-white/80 font-light mb-2">{rift.itemTitle}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-white/60 font-light">
                              {rift.itemType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-white/40">•</span>
                            <span className="text-white/60 font-light">{role}</span>
                            <span className="text-white/40">•</span>
                            <span className="text-white/60 font-light">
                              {otherParty.name || otherParty.email.split('@')[0]}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-light text-lg mb-1">
                            {formatCurrency(rift.amount, rift.currency)}
                          </p>
                          <p className="text-white/40 font-light text-xs">
                            {new Date(rift.createdAt).toLocaleDateString()}
                          </p>
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

