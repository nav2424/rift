'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import RiftActions from '@/components/RiftActions'
import Timeline from '@/components/Timeline'
import MessagingPanel from '@/components/MessagingPanel'
import DeliveryStatus from '@/components/DeliveryStatus'
import DisputeHelpButton from '@/components/DisputeHelpButton'
import { useToast } from '@/components/ui/Toast'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet, calculateBuyerTotal } from '@/lib/fees'

interface RiftTransaction {
  id: string
  riftNumber: number | null
  itemTitle: string
  itemDescription: string
  itemType: string
  subtotal: number
  amount?: number
  buyerFee: number
  sellerFee: number
  sellerNet?: number
  currency: string
  status: string
  buyerId: string
  sellerId: string
  shippingAddress?: string | null
  notes?: string | null
  eventDateTz?: string | null
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
  timelineEvents: Array<{
    id: string
    escrowId: string
    type: string
    message: string
    createdById: string | null
    createdAt: string
    createdBy?: {
      name: string | null
      email: string
    } | null
  }>
  disputes: Array<{
    id: string
    type: string
    status: string
    reason: string
    raisedBy: {
      name: string | null
      email: string
    }
  }>
}

export default function RiftDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { showToast } = useToast()
  const [rift, setRift] = useState<RiftTransaction | null>(null)
  const [loading, setLoading] = useState(true)

  const riftId = params?.id as string

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && riftId) {
      loadRift()
      
      // Set up polling to refresh timeline every 3 seconds when page is visible
      // This ensures real-time updates without excessive requests
      let pollInterval: NodeJS.Timeout | null = null
      
      const startPolling = () => {
        if (pollInterval) return
        pollInterval = setInterval(() => {
          // Only poll if page is visible
          if (document.visibilityState === 'visible') {
            loadRift()
          }
        }, 3000)
      }
      
      const stopPolling = () => {
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
      }
      
      // Start polling when page is visible
      if (document.visibilityState === 'visible') {
        startPolling()
      }
      
      // Handle visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          loadRift() // Refresh immediately when page becomes visible
          startPolling()
        } else {
          stopPolling()
        }
      }
      
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        stopPolling()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [status, riftId, router])

  const loadRift = async () => {
    try {
      const response = await fetch(`/api/rifts/${riftId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        let errorData: any = {}
        let errorMessage = 'Unknown error'
        const contentType = response.headers.get('content-type')
        
        // Try to parse error response
        try {
          if (contentType && contentType.includes('application/json')) {
            const jsonData = await response.json()
            errorData = jsonData
            errorMessage = jsonData.error || jsonData.message || response.statusText || 'Unknown error'
          } else {
            const text = await response.text()
            errorMessage = text || response.statusText || 'Unknown error'
            errorData = { error: errorMessage }
          }
        } catch (parseError) {
          // If parsing fails, use status text
          errorMessage = response.statusText || 'Failed to parse error response'
          errorData = { error: errorMessage }
        }
        
        // Log error details
        console.error('API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          errorData: Object.keys(errorData).length > 0 ? errorData : undefined,
          url: `/api/rifts/${riftId}`,
        })
        
        if (response.status === 404) {
          showToast('Rift not found', 'error')
          router.push('/rifts')
          return
        }
        if (response.status === 403) {
          showToast('You do not have access to this rift', 'error')
          router.push('/rifts')
          return
        }
        if (response.status === 401) {
          showToast('Please sign in to view this rift', 'error')
          router.push('/auth/signin')
          return
        }
        
        // Use the errorMessage we already parsed, or fallback to errorData
        if (!errorMessage || errorMessage === 'Unknown error') {
          errorMessage = errorData.error || errorData.message || `Failed to load rift (${response.status})`
        }
        showToast(errorMessage, 'error')
        router.push('/rifts')
        return
      }

      const data = await response.json()
      setRift(data)
    } catch (error: any) {
      console.error('Error loading rift:', error)
      const errorMessage = error?.message || 'Failed to load rift. Please try again.'
      showToast(errorMessage, 'error')
      // Don't redirect on network errors - let user stay on page to retry
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED': return 'text-green-400 border-green-500/30 bg-green-500/10'
      case 'REFUNDED': return 'text-red-400 border-red-500/30 bg-red-500/10'
      case 'DISPUTED': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
      case 'CANCELLED': return 'text-gray-400 border-gray-500/30 bg-gray-500/10'
      case 'FUNDED': return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
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

  if (status === 'unauthenticated' || !rift) {
    return null
  }

  const isBuyer = rift.buyerId === session?.user?.id
  const isSeller = rift.sellerId === session?.user?.id
  const isAdmin = session?.user?.role === 'ADMIN'
  const currentUserRole = isBuyer ? 'BUYER' : isSeller ? 'SELLER' : isAdmin ? 'ADMIN' : 'USER'
  const otherParty = isBuyer ? rift.seller : rift.buyer

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
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Link 
                  href="/rifts"
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center group"
                >
                  <svg className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight">
                  Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                </h1>
                <span className={`px-4 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm ${getStatusColor(rift.status)}`}>
                  {getStatusLabel(rift.status)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3 ml-11">
                <p className="text-white/90 font-light text-xl">{rift.itemTitle}</p>
                {isBuyer && (
                  <DisputeHelpButton
                    riftId={rift.id}
                    itemType={rift.itemType}
                    eventDateTz={rift.eventDateTz ? new Date(rift.eventDateTz) : null}
                    hasActiveDispute={rift.disputes?.some((d: any) => ['OPEN', 'UNDER_REVIEW'].includes(d.status))}
                  />
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-white/50 font-light ml-11">
                <span className="text-white/60">
                  {rift.itemType.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                </span>
                <span className="text-white/30">•</span>
                <span className="text-white/60">{isBuyer ? 'Buyer' : 'Seller'}</span>
                <span className="text-white/30">•</span>
                <span className="text-white/60">
                  {(otherParty.name || otherParty.email.split('@')[0]).split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                </span>
              </div>
            </div>
            <div className="text-right md:text-right">
              <div className="inline-block p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <p className="text-white/50 font-light text-xs mb-1 uppercase tracking-wider">Rift Value</p>
                <p className="text-white font-light text-3xl mb-2">
                  {formatCurrency(rift.subtotal || rift.amount || 0, rift.currency)}
                </p>
                <p className="text-white/40 font-light text-xs">
                  Created {new Date(rift.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Details */}
          <div className="lg:col-span-2 space-y-10">
            {/* Description */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
              <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">Description</h2>
                <p className="text-white/80 font-light leading-relaxed text-base">{rift.itemDescription}</p>
              </div>
            </section>

            {/* Timeline */}
            {rift.timelineEvents && rift.timelineEvents.length > 0 && (
              <section className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
                <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  <Timeline 
                    events={rift.timelineEvents.map(e => ({
                      ...e,
                      createdAt: new Date(e.createdAt)
                    }))}
                    isBuyer={isBuyer}
                    isSeller={isSeller}
                    riftValue={rift.subtotal || rift.amount}
                    currency={rift.currency}
                  />
                </div>
              </section>
            )}

            {/* Disputes */}
            {rift.disputes && rift.disputes.length > 0 && (
              <section className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
                <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  <h2 className="text-lg font-light text-white/90 mb-5 tracking-wide uppercase text-xs">Disputes</h2>
                  <div className="space-y-3">
                    {rift.disputes.map((dispute) => (
                      <div key={dispute.id} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white/90">{dispute.type.replace(/_/g, ' ')}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                            dispute.status === 'OPEN' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            dispute.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {dispute.status}
                          </span>
                        </div>
                        <p className="text-sm text-white/70 font-light leading-relaxed">{dispute.reason}</p>
                        <p className="text-xs text-white/50 font-light mt-3 pt-3 border-t border-white/5">
                          Raised by {dispute.raisedBy.name || dispute.raisedBy.email}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Messaging */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <MessagingPanel transactionId={rift.id} />
              </div>
            </section>
          </div>

          {/* Right column - Actions & Info */}
          <div className="space-y-8">
            {/* Delivery Status */}
            {(rift.itemType === 'DIGITAL' || rift.itemType === 'TICKETS' || rift.itemType === 'SERVICES') && (
              <DeliveryStatus
                riftId={rift.id}
                itemType={rift.itemType}
                status={rift.status}
              />
            )}

            {/* Actions - Only shows card wrapper when actions are available */}
            <RiftActions 
              rift={rift}
              currentUserRole={currentUserRole}
              userId={session?.user?.id || ''}
              isBuyer={isBuyer}
              isSeller={isSeller}
            />

            {/* Transaction Info */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
              <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                <h2 className="text-lg font-light text-white/90 mb-5 tracking-wide uppercase text-xs">Transaction Details</h2>
                <div className="space-y-4">
                  {isBuyer ? (
                    // Buyer View: Show processing fee
                    <>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-white/60 font-light text-sm">Rift Value</span>
                        <span className="text-white font-medium text-base">
                          {formatCurrency(rift.subtotal || rift.amount || 0, rift.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-white/60 font-light text-sm">Processing Fee (3%)</span>
                        <span className="text-white/70 font-light text-sm">
                          +{formatCurrency(calculateBuyerFee(rift.subtotal || rift.amount || 0), rift.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/10">
                        <span className="text-white font-light">You Pay</span>
                        <span className="text-green-400 font-medium text-lg">
                          {formatCurrency(calculateBuyerTotal(rift.subtotal || rift.amount || 0), rift.currency)}
                        </span>
                      </div>
                    </>
                  ) : (
                    // Seller View: Show platform fee and net amount
                    <>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-white/60 font-light text-sm">Rift Value</span>
                        <span className="text-white font-medium text-base">
                          {formatCurrency(rift.subtotal || rift.amount || 0, rift.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-white/60 font-light text-sm">Platform Fee (5%)</span>
                        <span className="text-white/70 font-light text-sm">
                          -{formatCurrency(calculateSellerFee(rift.subtotal || rift.amount || 0), rift.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/10">
                        <span className="text-white font-light">You Receive</span>
                        <span className="text-green-400 font-medium text-lg">
                          {formatCurrency(calculateSellerNet(rift.subtotal || rift.amount || 0), rift.currency)}
                        </span>
                      </div>
                    </>
                  )}
                  {rift.shippingAddress && (
                    <div className="pt-4 border-t border-white/10">
                      <span className="text-white/60 font-light text-xs block mb-2 uppercase tracking-wide">Shipping Address</span>
                      <span className="text-white/80 font-light text-sm leading-relaxed">{rift.shippingAddress}</span>
                    </div>
                  )}
                  {rift.notes && (
                    <div className="pt-4 border-t border-white/10">
                      <span className="text-white/60 font-light text-xs block mb-2 uppercase tracking-wide">Notes</span>
                      <span className="text-white/80 font-light text-sm leading-relaxed">{rift.notes}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="text-white/50 font-light text-xs uppercase tracking-wide">Created</span>
                    <span className="text-white/70 font-light text-sm">
                      {new Date(rift.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
