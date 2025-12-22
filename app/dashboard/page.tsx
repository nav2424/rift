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
  const [showAllActions, setShowAllActions] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadEscrows = async () => {
    try {
      const response = await fetch('/api/rifts/list?limit=50', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        // Handle both old format (rifts) and new paginated format (data)
        setRifts(data.data || data.rifts || [])
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
      loadEscrows()
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
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
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
              loadEscrows()
            }
            return prev
          }
        })
      },
      (newEscrow) => {
        // New rift created - only reload if list is small enough
        // Otherwise user can refresh to see it
        setRifts((prev) => {
          if (prev.length < 20) {
            loadEscrows()
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
    loadEscrows()
  }

  const metrics = useMemo(() => {
    // Exclude cancelled rifts from all metrics
    const validEscrows = rifts.filter(e => e.status !== 'CANCELLED')
    
    const active = validEscrows.filter(e => 
      ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
    )
    const completed = validEscrows.filter(e => ['RELEASED', 'PAID_OUT'].includes(e.status))
    const buying = validEscrows.filter(e => e.buyerId === session?.user?.id)
    const selling = validEscrows.filter(e => e.sellerId === session?.user?.id)
    const disputed = validEscrows.filter(e => e.status === 'DISPUTED')
    const totalTransactions = validEscrows.length
    const successRate = totalTransactions > 0 
      ? Math.round((completed.length / totalTransactions) * 100) 
      : 0
    
    // Total value = active + completed (excludes cancelled)
    // Use subtotal if available, otherwise fall back to amount
    const totalValue = active.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0) + 
                      completed.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0)
    const activeValue = active.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0)
    const completedValue = completed.reduce((sum, e) => sum + ((e as any).subtotal || e.amount || 0), 0)
    
    const pendingActions = validEscrows.filter(e => {
      if (e.buyerId === session?.user?.id) {
        return ['AWAITING_PAYMENT', 'FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(e.status)
      } else {
        return ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'AWAITING_SHIPMENT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
      }
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

  const activeEscrows = useMemo(() => {
    return rifts.filter(e => 
      ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
    )
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusLabel = (status: string) => {
    // Map status values to display labels
    if (status === 'FUNDED') return 'Paid'
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
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User'
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
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header - Compact */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-1">{greeting}</p>
              <h1 className="text-3xl md:text-4xl font-light text-white mb-1 tracking-tight">
                {userName}
              </h1>
              {metrics.activeCount === 0 && metrics.pendingActionsCount === 0 && (
                <p className="text-sm text-white/60 font-light">You're all set! Ready to create your first rift?</p>
              )}
              {metrics.pendingActionsCount > 0 && (
                <p className="text-sm text-white/60 font-light">
                  {metrics.pendingActionsCount} {metrics.pendingActionsCount === 1 ? 'action' : 'actions'} waiting
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications Badge */}
              {unreadCount > 0 && (
                <Link href="/wallet" className="relative">
                  <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300 border border-white/20 text-white/60 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                </Link>
              )}
              <Link href="/rifts/new" className="group">
                <button className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-300 border border-white/20 text-white font-light text-sm">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Top Row: Wallet + Portfolio Side by Side */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          {/* Wallet Card - Compact */}
          <div className="min-h-0">
            <WalletCard />
          </div>

          {/* Portfolio Card - Compact */}
          {metrics.totalValue > 0 && (
            <GlassCard>
              <div className="p-4">
                <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Transaction Summary</p>
                <p className="text-3xl font-light text-white mb-2 tracking-tight">
                  {formatCurrency(metrics.totalValue, 'USD')}
                </p>
                <p className="text-xs text-white/40 font-light mb-4">
                  Total of active and completed transactions
                </p>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs text-white/60 font-light mb-1">In Rifts</p>
                    <p className="text-lg font-light text-white">
                      {formatCurrency(metrics.activeValue, 'USD')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 font-light mb-1">Settled</p>
                    <p className="text-lg font-light text-white">
                      {formatCurrency(metrics.completedValue, 'USD')}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Second Row: Actions Required + Recent Activity Side by Side */}
        <div className={`grid gap-4 mb-4 ${metrics.pendingActionsCount > 0 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {/* Actions Required - Compact (only show if there are actions) */}
          {metrics.pendingActionsCount > 0 && (
            <GlassCard className="border-blue-500/20">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-light text-white">Action Required</h2>
                    <p className="text-xs text-white/60 font-light">
                      {metrics.pendingActionsCount === 1 
                        ? '1 thing needs attention'
                        : `${metrics.pendingActionsCount} things need attention`}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(showAllActions ? metrics.pendingActions : metrics.pendingActions.slice(0, 2)).map((action) => {
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
                  } else if (isBuyer && action.status === 'FUNDED') {
                    actionText = 'Waiting for proof'
                    actionDescription = 'Seller will submit proof of delivery'
                  } else if (isBuyer && (action.status === 'PROOF_SUBMITTED' || action.status === 'UNDER_REVIEW')) {
                    actionText = 'Review and release'
                    actionDescription = 'Release funds or open dispute'
                  } else if (!isBuyer && action.status === 'FUNDED') {
                    actionText = 'Submit proof'
                    actionDescription = 'Upload proof of delivery'
                  } else if (!isBuyer && (action.status === 'PROOF_SUBMITTED' || action.status === 'UNDER_REVIEW')) {
                    actionText = 'Waiting for release'
                    actionDescription = 'Buyer will review and release'
                  } else if (action.status === 'DELIVERED_PENDING_RELEASE') {
                    actionText = isBuyer ? 'Confirm you received it' : 'Release payment'
                    actionDescription = isBuyer ? 'Mark as delivered' : 'Send funds to seller'
                  }

                  return (
                    <Link
                      key={action.id}
                      href={`/rifts/${action.id}`}
                      className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-light truncate">{actionText}</p>
                          <p className="text-xs text-white/60 font-light truncate">{actionDescription}</p>
                        </div>
                        <svg className="w-4 h-4 text-white/40 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )
                })}
                {metrics.pendingActionsCount > 2 && (
                  <button
                    onClick={() => setShowAllActions(!showAllActions)}
                    className="block w-full p-2 text-center text-xs text-white/60 hover:text-white font-light transition-colors"
                  >
                    {showAllActions 
                      ? 'Show less' 
                      : `View ${metrics.pendingActionsCount - 2} more...`}
                  </button>
                )}
              </div>
            </div>
          </GlassCard>
          )}

          {/* Recent Activity - Always show */}
          <GlassCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center border border-cyan-500/20 flex-shrink-0">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-light text-white">Recent Activity</h2>
                </div>
                {recentActivity.length > 0 && (
                  <Link href="/activity" className="text-xs text-white/60 hover:text-white font-light flex items-center gap-1">
                    View All
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
              {recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.slice(0, 3).map((activity) => (
                    <Link
                      key={activity.id}
                      href={`/rifts/${activity.id}`}
                      className="block p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <p className="text-xs text-white/80 font-light line-clamp-1">{activity.message}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-white/40 font-light">No recent activity</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Your Rifts - Compact */}
        <div className="mt-8 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-light text-white">Your Rifts</h2>
            {rifts.length > 0 && (
              <Link href="/rifts" className="text-xs text-white/60 hover:text-white font-light flex items-center gap-1">
                View All
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
          
          {activeEscrows.length === 0 ? (
            <GlassCard>
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-light text-white mb-2">No rifts yet</h3>
                <p className="text-white/60 font-light text-xs mb-4">
                  Create your first rift to get started
                </p>
                <Link 
                  href="/rifts/new"
                  className="inline-block px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors border border-purple-500/30 text-white font-light text-sm"
                >
                  Create Rift
                </Link>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {activeEscrows.slice(0, 3).map((rift) => {
                const isBuyer = rift.buyerId === session?.user?.id
                const otherParty = isBuyer ? rift.seller : rift.buyer

                return (
                  <Link key={rift.id} href={`/rifts/${rift.id}`}>
                    <GlassCard className="hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-light text-white truncate">
                                Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                              </h3>
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${getStatusColor(rift.status)} border-current/30 bg-current/10 flex-shrink-0`}>
                                {getStatusLabel(rift.status)}
                              </span>
                            </div>
                            <p className="text-sm text-white/80 font-light truncate mb-1">{rift.itemTitle}</p>
                            <p className="text-xs text-white/60 font-light truncate">
                              {otherParty.name || otherParty.email.split('@')[0]} • {rift.itemType.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-light text-white">
                              {formatCurrency((rift as any).subtotal || rift.amount || 0, rift.currency)}
                            </p>
                            {(rift as any).buyerFee && (rift as any).buyerFee > 0 && isBuyer && (
                              <p className="text-xs text-white/40 font-light">
                                + {formatCurrency((rift as any).buyerFee, rift.currency)} fee
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                )
              })}
              {activeEscrows.length > 3 && (
                <Link href="/rifts" className="block p-3 text-center text-sm text-white/60 hover:text-white font-light border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                  View {activeEscrows.length - 3} more rifts...
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
