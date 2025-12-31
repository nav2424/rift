'use client'

import { useState, useEffect } from 'react'
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
  subtotal?: number
  buyerFee?: number
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

export default function ActionsRequiredPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && session?.user?.id) {
      loadActionsRequired()
    }
  }, [status, router, session?.user?.id])

  const loadActionsRequired = async () => {
    if (!session?.user?.id) {
      console.warn('No user session found')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch('/api/rifts/list?limit=100', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        const allRifts = data.data || data.rifts || []
        const userId = session.user.id
        
        console.log('Loading actions required:', {
          userId,
          totalRifts: allRifts.length,
          riftsWithStatus: allRifts.map(r => ({ id: r.id, status: r.status, buyerId: r.buyerId, sellerId: r.sellerId }))
        })
        
        // Filter for rifts that require action from the current user
        // Exclude actions waiting on the other party (e.g., buyer waiting for seller to submit proof)
        const pendingActions = allRifts.filter((rift: RiftTransaction) => {
          const isBuyer = rift.buyerId === userId
          const isSeller = rift.sellerId === userId
          
          if (isBuyer) {
            // Buyer actions: AWAITING_PAYMENT (needs to pay), PROOF_SUBMITTED/UNDER_REVIEW (needs to review/release)
            // Exclude FUNDED (buyer has paid, waiting for seller to submit proof)
            return ['AWAITING_PAYMENT', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)
          } else if (isSeller) {
            // Seller actions: FUNDED (needs to submit proof), AWAITING_SHIPMENT (needs to ship), DELIVERED_PENDING_RELEASE (needs to release)
            // Exclude PROOF_SUBMITTED/UNDER_REVIEW (seller has submitted, waiting for buyer to review)
            const requiresAction = ['FUNDED', 'AWAITING_SHIPMENT', 'DELIVERED_PENDING_RELEASE'].includes(rift.status)
            if (rift.status === 'FUNDED') {
              console.log('Found FUNDED rift for seller:', {
                riftId: rift.id,
                riftNumber: rift.riftNumber,
                status: rift.status,
                sellerId: rift.sellerId,
                currentUserId: userId,
                isSeller,
                match: rift.sellerId === userId
              })
            }
            return requiresAction
          }
          return false
        })
        
        console.log('Actions required filter result:', {
          totalRifts: allRifts.length,
          pendingActions: pendingActions.length,
          userId: userId,
          filteredRifts: pendingActions.map(r => ({ 
            id: r.id, 
            status: r.status, 
            isBuyer: r.buyerId === userId, 
            isSeller: r.sellerId === userId,
            buyerId: r.buyerId,
            sellerId: r.sellerId
          }))
        })
        
        setRifts(pendingActions)
      }
    } catch (error) {
      console.error('Error loading actions required:', error)
      showToast('Failed to load actions. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getActionText = (rift: RiftTransaction) => {
    const isBuyer = rift.buyerId === session?.user?.id
    const subtotal = rift.subtotal || rift.amount || 0
    
    if (isBuyer && rift.status === 'AWAITING_PAYMENT') {
      return {
        title: 'Pay this rift',
        description: formatCurrency(subtotal, rift.currency),
      }
    } else if (isBuyer && (rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW')) {
      return {
        title: 'Review and release',
        description: 'Release funds or open dispute',
      }
    } else if (!isBuyer && rift.status === 'FUNDED') {
      return {
        title: 'Submit proof',
        description: 'Upload proof of delivery',
      }
    } else if (rift.status === 'DELIVERED_PENDING_RELEASE') {
      return {
        title: isBuyer ? 'Confirm you received it' : 'Release payment',
        description: isBuyer ? 'Mark as delivered' : 'Send funds to seller',
      }
    } else if (rift.status === 'AWAITING_SHIPMENT') {
      return {
        title: 'Upload proof of shipment',
        description: 'Provide tracking information',
      }
    }
    
    return {
      title: 'Action required',
      description: rift.status.replace(/_/g, ' ').toLowerCase(),
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

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/25 to-blue-500/10 flex items-center justify-center border border-blue-500/25 shadow-lg shadow-blue-500/10 flex-shrink-0 mt-1">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-light text-white mb-2 tracking-tight">
                  Actions Required
                </h1>
                <p className="text-white/60 font-light">
                  {rifts.length === 0 
                    ? 'No actions required'
                    : `${rifts.length} ${rifts.length === 1 ? 'action' : 'actions'} need your attention`}
                </p>
              </div>
            </div>
            <Link 
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Actions List */}
        {rifts.length === 0 ? (
          <GlassCard className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-500/0">
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-500/10 flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-light text-white mb-3">All caught up!</h3>
              <p className="text-white/50 font-light text-sm mb-6">
                You don't have any pending actions right now.
              </p>
              <Link 
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 text-white font-light text-sm shadow-lg"
              >
                Go to Dashboard
              </Link>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-5">
            {rifts.map((rift) => {
              const isBuyer = rift.buyerId === session?.user?.id
              const otherParty = isBuyer ? rift.seller : rift.buyer
              const actionInfo = getActionText(rift)
              
              return (
                <Link key={rift.id} href={`/rifts/${rift.id}`}>
                  <GlassCard className="hover:bg-white/5 hover:border-blue-500/30 transition-all duration-300 cursor-pointer group border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/2 to-transparent">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-light text-white">
                              Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                            </h3>
                            <span className="text-xs px-2 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 font-light">
                              {actionInfo.title}
                            </span>
                          </div>
                          <p className="text-base text-white/90 font-light mb-2">{rift.itemTitle}</p>
                          <p className="text-sm text-white/50 font-light mb-3">
                            {otherParty.name || otherParty.email.split('@')[0]} • {rift.itemType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-white/60 font-light">{actionInfo.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end">
                          <p className="text-lg font-light text-white mb-1">
                            {formatCurrency(rift.subtotal || rift.amount || 0, rift.currency)}
                          </p>
                          {rift.buyerFee && rift.buyerFee > 0 && isBuyer && (
                            <p className="text-xs text-white/40 font-light">
                              + {formatCurrency(rift.buyerFee, rift.currency)} fee
                            </p>
                          )}
                          <svg className="w-5 h-5 text-white/30 group-hover:text-blue-400 group-hover:translate-x-1 mt-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  )
}

