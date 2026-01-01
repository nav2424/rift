'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import WalletCard from '@/components/WalletCard'
import { subscribeToUserRifts } from '@/lib/realtime-rifts'
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

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadRifts = async () => {
    try {
      const response = await fetch('/api/rifts/list?limit=50', {
        credentials: 'include',
      })
      if (response.ok) {
        const text = await response.text()
        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text)
            // Handle both old format (rifts) and new paginated format (data)
            setRifts(data.data || data.rifts || [])
          } catch (parseError) {
            console.error('Failed to parse rifts response:', parseError)
          }
        }
      }
    } catch (error) {
      console.error('Error loading rifts:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadRifts()
      loadNotifications()
      
      // Auto-refresh notifications every 60 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications()
      }, 60000)
      
      return () => clearInterval(notificationInterval)
    }
  }, [status, router])

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=5', {
        credentials: 'include',
      })
      if (response.ok) {
        const text = await response.text()
        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text)
            setNotifications(data.notifications || [])
            setUnreadCount(data.unreadCount || 0)
          } catch (parseError) {
            console.error('Failed to parse notifications response:', parseError)
          }
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
      // Silent failure for notifications - not critical
    }
  }


  // Real-time sync for rifts
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return

    const unsubscribe = subscribeToUserRifts(
      session.user.id,
      (update) => {
        // Optimistically update existing rift in local state
        setRifts((prev) => {
          const existingIndex = prev.findIndex((e) => e.id === update.id)
          if (existingIndex >= 0) {
            // Update existing rift with new data
            const updated = [...prev]
            updated[existingIndex] = { ...updated[existingIndex], ...update }
            return updated
          } else {
            // New rift - only reload if we have space in current view (optimization)
            // For now, still reload to ensure we have full data with relations
            // TODO: Consider adding new rift optimistically
            if (prev.length < 20) {
              loadRifts()
            }
            return prev
          }
        })
      },
      (newRift) => {
        // New rift created - only reload if list is small enough
        // Otherwise user can refresh to see it
        setRifts((prev) => {
          if (prev.length < 20) {
            loadRifts()
          }
          return prev
        })
      },
      (error) => {
        // Silently handle realtime errors - these are non-critical
        // Data will sync on next page refresh or manual reload
        console.debug('Realtime rift sync unavailable:', error.message)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [status, session?.user?.id])

  const handleRefresh = () => {
    setRefreshing(true)
    loadRifts()
  }

  const metrics = useMemo(() => {
    // Exclude cancelled rifts from all metrics
    const validRifts = rifts.filter(e => e.status !== 'CANCELLED')
    
    const active = validRifts.filter(e => {
      // Exclude terminal/final statuses
      const excludedStatuses = ['RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'CANCELED', 'CANCELLED', 'REFUNDED']
      return !excludedStatuses.includes(e.status)
    })
    const completed = validRifts.filter(e => ['RELEASED', 'PAID_OUT'].includes(e.status))
    const buying = validRifts.filter(e => e.buyerId === session?.user?.id)
    const selling = validRifts.filter(e => e.sellerId === session?.user?.id)
    const disputed = validRifts.filter(e => e.status === 'DISPUTED')
    const totalTransactions = validRifts.length
    const successRate = totalTransactions > 0 
      ? Math.round((completed.length / totalTransactions) * 100) 
      : 0
    
    // Total value = active + completed (excludes cancelled)
    // Use subtotal if available, otherwise fall back to amount
    const totalValue = active.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0) + 
                      completed.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0)
    const activeValue = active.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0)
    const completedValue = completed.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0)
    
    const pendingActions = validRifts.filter(e => {
      const isBuyer = e.buyerId === session?.user?.id
      const isSeller = e.sellerId === session?.user?.id
      
      if (isBuyer) {
        // Buyer actions: AWAITING_PAYMENT (needs to pay), PROOF_SUBMITTED/UNDER_REVIEW (needs to review/release)
        // Exclude FUNDED (buyer has paid, waiting for seller to submit proof)
        return ['AWAITING_PAYMENT', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(e.status)
      } else if (isSeller) {
        // Seller actions: FUNDED (needs to submit proof), AWAITING_SHIPMENT (needs to ship), DELIVERED_PENDING_RELEASE (needs to release)
        // Exclude PROOF_SUBMITTED/UNDER_REVIEW (seller has submitted, waiting for buyer to review)
        return ['FUNDED', 'AWAITING_SHIPMENT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
      }
      return false
    })

    return {
      totalValue,
      activeValue,
      completedValue,
      activeCount: active.length,
      buyingCount: buying.length,
      sellingCount: selling.length,
      disputedCount: disputed.length,
      pendingActionsCount: pendingActions.length,
      pendingActions,
      totalTransactions,
      successRate,
    }
  }, [rifts, session?.user?.id])

  // Show all rifts that are not RELEASED, PAYOUT_SCHEDULED, PAID_OUT, CANCELED, or REFUNDED
  const activeRifts = useMemo(() => {
    const excludedStatuses = ['RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'CANCELED', 'CANCELLED', 'REFUNDED']
    return rifts.filter(e => !excludedStatuses.includes(e.status))
  }, [rifts])

  const getRecentActivity = () => {
    const sorted = [...rifts].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 6)

    return sorted.map(rift => {
      const isBuyer = rift.buyerId === session?.user?.id
      const otherParty = isBuyer ? rift.seller : rift.buyer
      const name = otherParty.name || otherParty.email.split('@')[0]

      const riftNumber = rift.riftNumber ?? rift.id.slice(-4)
      let message = ''
      switch (rift.status) {
        case 'FUNDED':
          message = isBuyer
            ? `Rift #${riftNumber} — Payment received — waiting for seller proof`
            : `Rift #${riftNumber} — Payment received — submit proof of delivery`
          break
        case 'PROOF_SUBMITTED':
          message = isBuyer
            ? `Rift #${riftNumber} — Proof submitted — review and release`
            : `Rift #${riftNumber} — Proof submitted — waiting for release`
          break
        case 'UNDER_REVIEW':
          message = `Rift #${riftNumber} — Under review`
          break
        case 'RELEASED':
          message = `Rift #${riftNumber} — Funds released to seller wallet`
          break
        case 'PAYOUT_SCHEDULED':
          message = `Rift #${riftNumber} — Payout scheduled`
          break
        case 'PAID_OUT':
          message = `Rift #${riftNumber} — Payout completed`
          break
        case 'DISPUTED':
          message = `Rift #${riftNumber} — Dispute opened`
          break
        case 'RESOLVED':
          message = `Rift #${riftNumber} — Dispute resolved`
          break
        // Legacy statuses
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
        default:
          message = `Rift #${riftNumber} — ${rift.status.replace(/_/g, ' ').toLowerCase()}`
      }

      return { ...rift, message, name }
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusLabel = (status: string) => {
    // Map status values to display labels
    if (status === 'FUNDED' || status === 'PAID') return 'Paid'
    return status.replace(/_/g, ' ')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FUNDED': return 'text-blue-400'
      case 'PROOF_SUBMITTED': return 'text-purple-400'
      case 'UNDER_REVIEW': return 'text-yellow-400'
      case 'RELEASED': return 'text-green-400'
      case 'PAYOUT_SCHEDULED': return 'text-indigo-400'
      case 'PAID_OUT': return 'text-emerald-400'
      case 'DISPUTED': return 'text-red-400'
      case 'RESOLVED': return 'text-cyan-400'
      case 'CANCELED': return 'text-gray-400'
      // Legacy
      case 'REFUNDED': return 'text-red-400'
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

  const recentActivity = getRecentActivity()
  // Extract first name only from full name
  const getFirstName = (fullName: string | null | undefined): string => {
    if (!fullName) return session?.user?.email?.split('@')[0] || 'User'
    const firstName = fullName.trim().split(' ')[0]
    return firstName || session?.user?.email?.split('@')[0] || 'User'
  }
  const userName = getFirstName(session?.user?.name)
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 
                   new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

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
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12" data-onboarding="dashboard">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="mb-2">
                    <p className="text-xs text-white/40 font-light uppercase tracking-wider mb-3">{greeting}</p>
                    <h1 className="text-2xl md:text-3xl font-light text-white tracking-tight mb-4">
                      Welcome back, <span className="text-white/90">{userName}</span>
                    </h1>
                  </div>
                  {metrics.activeCount === 0 && metrics.pendingActionsCount === 0 && (
                    <p className="text-sm text-white/50 font-light">You're all set! Ready to create your first rift?</p>
                  )}
                  {metrics.pendingActionsCount > 0 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                      <p className="text-sm text-white/70 font-light">
                        {metrics.pendingActionsCount} {metrics.pendingActionsCount === 1 ? 'action' : 'actions'} waiting
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications Badge */}
              {unreadCount > 0 && (
                <Link href="/wallet" className="relative group">
                  <button className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 text-white/70 hover:text-white backdrop-blur-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-medium flex items-center justify-center shadow-lg shadow-red-500/50">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </button>
                </Link>
              )}
              <Link href="/rifts/new" className="group" data-onboarding="create-rift">
                <button className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 text-white font-light text-sm backdrop-blur-sm shadow-lg">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Rift
                  </span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Notifications Banner - Stripe Status Updates */}
        {notifications.filter(n => n.isStripeStatusChange).length > 0 && (
          <div className="mb-4">
            {notifications
              .filter(n => n.isStripeStatusChange)
              .slice(0, 1)
              .map((notification) => {
                const stripeStatus = notification.stripeStatus
                const isApproved = stripeStatus === 'approved'
                const isRejected = stripeStatus === 'rejected'
                const isRestricted = stripeStatus === 'restricted'
                
                return (
                  <Link key={notification.id} href="/wallet">
                    <GlassCard className={`cursor-pointer hover:bg-white/10 transition-all ${
                      isApproved ? 'border-green-500/30 bg-green-500/5' :
                      isRejected ? 'border-red-500/30 bg-red-500/5' :
                      isRestricted ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-blue-500/30 bg-blue-500/5'
                    }`}>
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isApproved ? 'bg-green-500/20' :
                              isRejected ? 'bg-red-500/20' :
                              isRestricted ? 'bg-yellow-500/20' :
                              'bg-blue-500/20'
                            }`}>
                              {isApproved ? (
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : isRejected ? (
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-light ${
                                isApproved ? 'text-green-400' :
                                isRejected ? 'text-red-400' :
                                isRestricted ? 'text-yellow-400' :
                                'text-blue-400'
                              }`}>
                                {notification.summary}
                              </p>
                              <p className="text-xs text-white/40 font-light mt-1">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                )
              })}
          </div>
        )}

        {/* Main Grid: Wallet (Left), Recent Activity (Middle), Actions Required (Right) */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6 items-stretch">
          {/* Left Column: Wallet */}
          <div className="flex flex-col">
            <div className="min-h-0 h-full">
              <WalletCard />
            </div>
          </div>

          {/* Middle Column: Recent Activity */}
          <div className="flex flex-col">
            <GlassCard className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-cyan-500/2 to-transparent hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 h-full flex flex-col">
              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-500/10 flex items-center justify-center border border-cyan-500/25 shadow-lg shadow-cyan-500/10 flex-shrink-0">
                        <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h2 className="text-lg font-light text-white">Recent Activity</h2>
                    </div>
                    {recentActivity.length > 0 && (
                      <Link href="/activity" className="text-xs text-cyan-400/80 hover:text-cyan-400 font-light flex items-center gap-1.5 transition-colors group">
                        View All
                        <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
                {recentActivity.length > 0 ? (
                  <div className="pt-6 border-t border-white/10 flex-1 flex flex-col">
                    <div className="space-y-2.5 flex-1">
                      {recentActivity.slice(0, 3).map((activity) => (
                        <Link
                          key={activity.id}
                          href={`/rifts/${activity.id}`}
                          className="block p-4 rounded-xl transition-all duration-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/30 hover:shadow-md hover:shadow-cyan-500/5 group h-20 flex items-center"
                        >
                          <p className="text-sm text-white/80 group-hover:text-white font-light leading-relaxed line-clamp-2 transition-colors">{activity.message}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-6 border-t border-white/10 flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-white/40 font-light">No recent activity</p>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Right Column: Actions Required */}
          <div className="flex flex-col">
            {/* Enhanced Actions Required - Always visible */}
            <GlassCard className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/2 to-transparent hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 h-full flex flex-col">
              <div className="p-8 flex flex-col flex-1">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/25 to-blue-500/10 flex items-center justify-center border border-blue-500/25 shadow-lg shadow-blue-500/10 flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-light text-white">Action Required</h2>
                    </div>
                  </div>
                  {metrics.pendingActionsCount > 0 && (
                    <Link href="/rifts/actions-required" className="text-xs text-blue-400/80 hover:text-blue-400 font-light flex items-center gap-1.5 transition-colors group">
                      View All
                      <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
              <div className="pt-6 border-t border-white/10 flex-1 flex flex-col">
                {metrics.pendingActionsCount > 0 ? (
                  <div className="space-y-2.5 flex-1">
                    {metrics.pendingActions.slice(0, 3).map((action) => {
                      const isBuyer = action.buyerId === session?.user?.id
                      let actionText = ''
                      let actionDescription = ''
                      const subtotal = (action as any).subtotal || action.amount || 0
                      // Calculate buyerFee if not present (3% of subtotal)
                      let buyerFee = (action as any).buyerFee
                      if (!buyerFee || buyerFee === 0) {
                        buyerFee = Math.round(subtotal * 0.03 * 100) / 100 // 3% fee
                      }
                      const buyerTotal = subtotal + buyerFee
                      
                      if (isBuyer && action.status === 'AWAITING_PAYMENT') {
                        actionText = 'Pay this rift'
                        // Show just the rift amount (without fee)
                        actionDescription = formatCurrency(subtotal, action.currency || 'CAD')
                      } else if (isBuyer && (action.status === 'PROOF_SUBMITTED' || action.status === 'UNDER_REVIEW')) {
                        actionText = 'Review and release'
                        actionDescription = 'Release funds or open dispute'
                      } else if (!isBuyer && action.status === 'FUNDED') {
                        actionText = 'Submit proof'
                        actionDescription = 'Upload proof of delivery'
                      } else if (action.status === 'DELIVERED_PENDING_RELEASE') {
                        actionText = isBuyer ? 'Confirm you received it' : 'Release payment'
                        actionDescription = isBuyer ? 'Mark as delivered' : 'Send funds to seller'
                      } else if (action.status === 'AWAITING_SHIPMENT') {
                        actionText = 'Upload proof of shipment'
                        actionDescription = 'Provide tracking information'
                      }

                      return (
                        <Link
                          key={action.id}
                          href={`/rifts/${action.id}#actions`}
                          className="block p-4 rounded-xl transition-all duration-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/5 group h-20 flex items-center"
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate mb-1.5">{actionText}</p>
                              <p className="text-xs text-white/60 font-light line-clamp-2 leading-relaxed">{actionDescription}</p>
                            </div>
                            <svg className="w-5 h-5 text-white/30 group-hover:text-blue-400 group-hover:translate-x-1 flex-shrink-0 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1 py-8">
                    <p className="text-white/60 font-light text-sm">No actions required at this time</p>
                  </div>
                )}
              </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Enhanced Your Rifts Section */}
        <div className="mt-10 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Your Rifts</h2>
            </div>
            {rifts.length > 0 && (
              <Link href="/rifts" className="text-sm text-white/50 hover:text-white font-light flex items-center gap-1.5 transition-colors group">
                View All
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
          
          {activeRifts.length === 0 ? (
            <GlassCard className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/0">
              <div className="p-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center mx-auto mb-6 border border-purple-500/30 shadow-lg shadow-purple-500/10">
                  <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light text-white mb-3">No rifts yet</h3>
                <p className="text-white/50 font-light text-sm mb-6">
                  Create your first rift to get started
                </p>
                <Link 
                  href="/rifts/new"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 text-white font-light text-sm shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Rift
                </Link>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-5">
              {activeRifts.slice(0, 3).map((rift) => {
                const isBuyer = rift.buyerId === session?.user?.id
                const otherParty = isBuyer ? rift.seller : rift.buyer

                return (
                  <Link key={rift.id} href={`/rifts/${rift.id}`}>
                    <GlassCard className="hover:bg-white/5 hover:border-white/20 transition-all duration-300 cursor-pointer group">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-light text-white truncate">
                                Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                              </h3>
                              <span className={`text-xs px-2 py-1 rounded-lg border ${getStatusColor(rift.status)} border-current/30 bg-current/10 flex-shrink-0 font-light`}>
                                {getStatusLabel(rift.status)}
                              </span>
                            </div>
                            <p className="text-base text-white/90 font-light truncate mb-1.5">{rift.itemTitle}</p>
                            <p className="text-sm text-white/50 font-light truncate">
                              {otherParty.name || otherParty.email.split('@')[0]} • {rift.itemType.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 flex flex-col items-end">
                            <p className="text-lg font-light text-white mb-1">
                              {formatCurrency((rift as any).subtotal || rift.amount || 0, rift.currency)}
                            </p>
                            {(rift as any).buyerFee && (rift as any).buyerFee > 0 && isBuyer && (
                              <p className="text-xs text-white/40 font-light">
                                + {formatCurrency((rift as any).buyerFee, rift.currency)} fee
                              </p>
                            )}
                            <svg className="w-5 h-5 text-white/30 group-hover:text-white/50 group-hover:translate-x-1 mt-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
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
    </div>
  )
}
