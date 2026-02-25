'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import RiftActions from '@/components/RiftActions'
import Timeline from '@/components/Timeline'
import MessagingPreview from '@/components/MessagingPreview'
import DeliveryStatus from '@/components/DeliveryStatus'
import MilestoneCard from '@/components/MilestoneCard'
import InvoiceCard from '@/components/InvoiceCard'
import RiskScoreBadge from '@/components/RiskScoreBadge'
import DisputeWizard from '@/components/DisputeWizard'
import UGCDealPanels from '@/components/UGCDealPanels'
import { useToast } from '@/components/ui/Toast'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet, calculateBuyerTotal } from '@/lib/fees'
import { getItemTypeLabel } from '@/lib/item-type-labels'

type RiftStatus = 
  | 'DRAFT'
  | 'FUNDED'
  | 'PROOF_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RELEASED'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'PAYOUT_SCHEDULED'
  | 'PAID_OUT'
  | 'CANCELED'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'REFUNDED'
  | 'CANCELLED'

interface RiftTransaction {
  id: string
  riftNumber: number | null
  itemTitle: string
  itemDescription: string
  itemType: 'PHYSICAL' | 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES'
  subtotal: number
  amount?: number
  buyerFee: number
  sellerFee: number
  sellerNet?: number
  currency: string
  status: RiftStatus
  buyerId: string
  sellerId: string
  shippingAddress?: string | null
  notes?: string | null
  eventDateTz?: string | null
  allowsPartialRelease?: boolean
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
    riftId?: string
    escrowId?: string
    type: string
    message: string
    createdById: string | null
    createdAt: string
    createdBy?: {
      name: string | null
      email: string
    } | null
  }>
  Dispute: Array<{
    id: string
    type: string
    status: string
    reason: string
    summary?: string
    raisedBy: {
      id: string
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
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null)
  const [showDisputeWizard, setShowDisputeWizard] = useState(false)
  const [showDisputeSummary, setShowDisputeSummary] = useState(false)
  const [disputeSummary, setDisputeSummary] = useState<{
    reason: string
    summary: string
    evidence: Array<{ type: string; fileName?: string; textContent?: string; url?: string }>
  } | null>(null)

  const riftId = params?.id as string

  // Disable background scroll while modals are open
  useEffect(() => {
    if (showDisputeWizard || showDisputeSummary) {
      // Lock body scroll and hide content
      const prevOverflow = document.body.style.overflow
      const prevPosition = document.body.style.position
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.classList.add('modal-open')
      
      return () => {
        document.body.style.overflow = prevOverflow
        document.body.style.position = prevPosition
        document.body.style.width = ''
        document.body.classList.remove('modal-open')
      }
    }
  }, [showDisputeWizard, showDisputeSummary])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && riftId) {
      loadRift()
      
      // Polling removed - page will only refresh when manually reloaded or when user returns to the page
    }
  }, [status, riftId, router])

  // Scroll to actions section when hash is present
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#actions') {
      // Wait for rift to load and component to render
      if (rift) {
        setTimeout(() => {
          const actionsElement = document.getElementById('rift-actions')
          if (actionsElement) {
            actionsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
            // Remove hash from URL after scrolling
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          }
        }, 100)
      }
    }
  }, [rift])

  const loadRift = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/rifts/${riftId}`, {
        credentials: 'include',
      })

      if (!response) {
        throw new Error('No response received from server')
      }

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
            if (text) {
              errorData = { error: errorMessage, rawText: text }
            } else {
              errorData = { error: errorMessage }
            }
          }
        } catch (parseError: any) {
          // If parsing fails, use status text
          errorMessage = response.statusText || 'Failed to parse error response'
          errorData = { 
            error: errorMessage,
            parseError: parseError?.message || String(parseError)
          }
        }
        
        // Log error details with all available information
        const errorLogData: any = {
          status: response.status || 'unknown',
          statusText: response.statusText || 'unknown',
          error: errorMessage || 'Unknown error',
          url: `/api/rifts/${riftId}`,
          riftId: riftId,
        }
        
        // Always include errorData if it exists
        if (errorData && typeof errorData === 'object') {
          errorLogData.errorData = errorData
        }
        
        console.error('API error:', JSON.stringify(errorLogData, null, 2))
        
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
      // Handle network errors or other fetch failures
      console.error('Error loading rift:', {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
        name: error?.name,
        riftId: riftId,
        url: `/api/rifts/${riftId}`,
        fullError: error,
      })
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
      case 'FUNDED': return 'text-blue-400 border-blue-500/30 bg-blue-500/10' // Paid
      case 'AWAITING_PAYMENT': return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      case 'AWAITING_SHIPMENT': return 'text-purple-400 border-purple-500/30 bg-purple-500/10'
      case 'IN_TRANSIT': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
      case 'DELIVERED_PENDING_RELEASE': return 'text-teal-400 border-teal-500/30 bg-teal-500/10'
      case 'PROOF_SUBMITTED': return 'text-purple-400 border-purple-500/30 bg-purple-500/10'
      case 'UNDER_REVIEW': return 'text-purple-400 border-purple-500/30 bg-purple-500/10'
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
  const currentUserRole: 'BUYER' | 'SELLER' | 'ADMIN' = isBuyer ? 'BUYER' : isSeller ? 'SELLER' : 'ADMIN'
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <Link 
              href="/rifts"
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center group"
            >
              <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">
                  {rift.itemTitle}
                </h1>
                <span className={`px-4 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm ${getStatusColor(rift.status)}`}>
                  {getStatusLabel(rift.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-white/50 font-light">
                <span className="text-white/60">
                  Rift #{rift.riftNumber ?? rift.id.slice(-4)}
                </span>
                <span className="text-white/20">•</span>
                <span className="text-white/60">
                  {getItemTypeLabel(rift.itemType)}
                </span>
                <span className="text-white/20">•</span>
                <span className="text-white/60">{isBuyer ? 'Buyer' : 'Seller'}</span>
                <span className="text-white/20">•</span>
                <span className="text-white/60">
                  {(otherParty.name || otherParty.email.split('@')[0]).split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                </span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                <p className="text-white/50 font-light text-xs mb-2 uppercase tracking-wider">Rift Value</p>
                <p className="text-white font-light text-4xl mb-1">
                  {formatCurrency(rift.subtotal || rift.amount || 0, rift.currency)}
                </p>
                <p className="text-white/40 font-light text-xs">
                  Created {new Date(rift.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column - Details */}
          <div className="lg:col-span-7 space-y-8">
            {/* Payment Milestones - Only for service rifts with partial release */}
            {rift.itemType === 'SERVICES' && rift.allowsPartialRelease && rift.milestones && (
              <MilestoneCard
                riftId={rift.id}
                currency={rift.currency}
                isBuyer={isBuyer}
                riftStatus={rift.status}
              />
            )}

            {/* UGC deal panels (milestones + contract + timeline + trust) */}
            {rift.itemType === 'SERVICES' && rift.allowsPartialRelease && !rift.milestones && (
              <UGCDealPanels
                riftId={rift.id}
                isBuyer={isBuyer}
                isSeller={isSeller}
                currency={rift.currency}
              />
            )}

            {/* Invoice - Only for service rifts */}
            {rift.itemType === 'SERVICES' && (
              <InvoiceCard
                riftId={rift.id}
                isSeller={isSeller}
                currency={rift.currency}
              />
            )}

            {/* Messaging Preview */}
            <GlassCard>
              <MessagingPreview transactionId={rift.id} />
            </GlassCard>

            {/* Description */}
            <GlassCard className="p-8">
              <h2 className="text-sm font-light text-white/60 mb-5 tracking-wider uppercase">Description</h2>
              <p className="text-white/80 font-light leading-relaxed text-lg">{rift.itemDescription}</p>
            </GlassCard>

            {/* Timeline */}
            {rift.timelineEvents && rift.timelineEvents.length > 0 && (
              <GlassCard className="p-8">
                <Timeline 
                  events={rift.timelineEvents.map(e => ({
                    ...e,
                    riftId: e.riftId || e.escrowId || rift.id,
                    createdAt: new Date(e.createdAt)
                  }))}
                  isBuyer={isBuyer}
                  isSeller={isSeller}
                  riftValue={rift.subtotal || rift.amount}
                  currency={rift.currency}
                />
              </GlassCard>
            )}

            {/* Disputes */}
            {rift.Dispute && rift.Dispute.length > 0 && (
              <GlassCard className="p-8">
                <h2 className="text-sm font-light text-white/60 mb-6 tracking-wider uppercase">Disputes</h2>
                <div className="space-y-4">
                  {rift.Dispute.map((dispute) => {
                    const isDraft = dispute.status === 'draft' || dispute.status === 'needs_info'
                    // Check if current user raised the dispute (by email or ID)
                    const userRaisedDispute = dispute.raisedBy?.id === session?.user?.id || 
                                            dispute.raisedBy?.email === session?.user?.email
                    const canEdit = isDraft && userRaisedDispute
                    
                    return (
                      <button
                        key={dispute.id}
                        onClick={async () => {
                          setSelectedDisputeId(dispute.id)
                          if (isDraft && canEdit) {
                            setShowDisputeWizard(true)
                          } else {
                            // Fetch dispute summary for viewing
                            try {
                              const response = await fetch(`/api/disputes/${dispute.id}/summary`, {
                                credentials: 'include',
                              })
                              if (response.ok) {
                                const data = await response.json()
                                setDisputeSummary(data)
                                setShowDisputeSummary(true)
                              } else {
                                showToast('Failed to load dispute summary', 'error')
                              }
                            } catch (error) {
                              console.error('Error loading dispute summary:', error)
                              showToast('Failed to load dispute summary', 'error')
                            }
                          }
                        }}
                        className="w-full text-left p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-white/90">
                            {dispute.type ? dispute.type.replace(/_/g, ' ') : dispute.reason || 'Dispute'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                            dispute.status === 'OPEN' || dispute.status === 'open' || dispute.status === 'submitted' || dispute.status === 'under_review' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            dispute.status === 'RESOLVED' || dispute.status === 'resolved' || dispute.status === 'resolved_buyer' || dispute.status === 'resolved_seller' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            dispute.status === 'draft' || dispute.status === 'needs_info' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}>
                            {dispute.status || 'Unknown'}
                          </span>
                        </div>
                        <p className="text-sm text-white/70 font-light leading-relaxed mb-3">{dispute.reason || dispute.summary || 'No reason provided'}</p>
                        <p className="text-xs text-white/50 font-light pt-3 border-t border-white/5">
                          Raised by {dispute.raisedBy?.name || dispute.raisedBy?.email || 'Unknown user'}
                          {isDraft && canEdit && (
                            <span className="ml-2 text-blue-400 text-xs">(Click to edit)</span>
                          )}
                          {!isDraft && (
                            <span className="ml-2 text-white/40 text-xs">(Click to view)</span>
                          )}
                          {isDraft && !canEdit && (
                            <span className="ml-2 text-white/40 text-xs">(Click to view)</span>
                          )}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Right column - Actions & Info */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Actions - Always at the top and sticky */}
              <div id="rift-actions">
                <RiftActions 
                  rift={rift}
                  currentUserRole={currentUserRole}
                  userId={session?.user?.id || ''}
                  isBuyer={isBuyer}
                  isSeller={isSeller}
                />
              </div>

              {/* Risk Score Badge - Show for admins only */}
              {isAdmin && (
                <RiskScoreBadge riftId={rift.id} />
              )}

              {/* Mobile: Rift Value */}
              <div className="md:hidden">
                <GlassCard className="p-6">
                  <p className="text-white/50 font-light text-xs mb-2 uppercase tracking-wider">Rift Value</p>
                  <p className="text-white font-light text-3xl mb-1">
                    {formatCurrency(rift.subtotal || rift.amount || 0, rift.currency)}
                  </p>
                  <p className="text-white/40 font-light text-xs">
                    Created {new Date(rift.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </GlassCard>
              </div>

              {/* Transaction Info */}
              <GlassCard className="p-6">
              <h2 className="text-sm font-light text-white/60 mb-6 tracking-wider uppercase">Transaction Details</h2>
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
              </GlassCard>

              {/* Delivery Status */}
              {(['DIGITAL_GOODS', 'OWNERSHIP_TRANSFER', 'SERVICES'].includes(rift.itemType as string)) && (
                <DeliveryStatus
                  riftId={rift.id}
                  itemType={rift.itemType as 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES'}
                  status={rift.status}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dispute Wizard Modal */}
      {showDisputeWizard && selectedDisputeId && rift && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
          <div
            className="fixed inset-0 bg-black pointer-events-auto"
            data-modal-backdrop
            style={{ 
              zIndex: 2147483647,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
            }}
            onClick={() => {
              setShowDisputeWizard(false)
              setSelectedDisputeId(null)
            }}
          />
          {/* Modal */}
          <div 
            className="fixed inset-0 flex items-center justify-center p-6 pointer-events-none" 
            data-modal-content
            style={{ 
              zIndex: 2147483647,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {/* Close button - outside modal window */}
            <button
              onClick={() => {
                setShowDisputeWizard(false)
                setSelectedDisputeId(null)
              }}
              className="absolute top-6 right-6 z-30 text-white/80 hover:text-white transition-colors p-3 rounded-lg hover:bg-white/10 pointer-events-auto"
              style={{ zIndex: 2147483647 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative w-[min(800px,90vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl pointer-events-auto">
              <div className="overflow-y-auto max-h-[90vh]">
                <DisputeWizard
                  riftId={rift.id}
                  itemType={rift.itemType}
                  eventDateTz={rift.eventDateTz ? (typeof rift.eventDateTz === 'string' ? new Date(rift.eventDateTz) : rift.eventDateTz) : null}
                  onClose={() => {
                    setShowDisputeWizard(false)
                    setSelectedDisputeId(null)
                    // Reload rift data to refresh disputes
                    if (riftId) {
                      loadRift()
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Dispute Summary Modal */}
      {showDisputeSummary && disputeSummary && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
          <div
            className="fixed inset-0 bg-black pointer-events-auto"
            data-modal-backdrop
            style={{ 
              zIndex: 2147483647,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
            }}
            onClick={() => {
              setShowDisputeSummary(false)
              setSelectedDisputeId(null)
              setDisputeSummary(null)
            }}
          />
          {/* Modal */}
          <div 
            className="fixed inset-0 flex items-center justify-center p-6 pointer-events-none" 
            data-modal-content
            style={{ 
              zIndex: 2147483647,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {/* Close button - outside modal window */}
            <button
              onClick={() => {
                setShowDisputeSummary(false)
                setSelectedDisputeId(null)
                setDisputeSummary(null)
              }}
              className="absolute top-6 right-6 z-30 text-white/80 hover:text-white transition-colors p-3 rounded-lg hover:bg-white/10 pointer-events-auto"
              style={{ zIndex: 2147483647 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative w-[min(800px,90vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl pointer-events-auto">
              <div className="overflow-y-auto max-h-[90vh] p-4">
                <GlassCard variant="strong" className="p-6 space-y-5">
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-2xl font-light text-white tracking-tight">Dispute Summary</h2>
                      <p className="text-white/60 font-light text-sm">Review of submitted dispute information</p>
                    </div>
                  </div>
                  
                  <div className="space-y-5 max-w-3xl mx-auto">
                    <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-5 overflow-hidden">
                      <div className="space-y-4 min-w-0">
                        <div className="pb-4 border-b border-white/10 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-white/40"></div>
                            <span className="text-white/60 font-light text-xs uppercase tracking-wider">Reason</span>
                          </div>
                          <p className="text-white/90 font-light text-base pl-5 leading-relaxed break-words">
                            {disputeSummary.reason.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </p>
                        </div>

                        <div className="pb-4 border-b border-white/10 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-white/40"></div>
                            <span className="text-white/60 font-light text-xs uppercase tracking-wider">Summary</span>
                          </div>
                          <p className="text-white/80 font-light text-sm leading-relaxed pl-5 whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">
                            {disputeSummary.summary || 'No summary provided'}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-white/40"></div>
                            <span className="text-white/60 font-light text-xs uppercase tracking-wider">Evidence</span>
                          </div>
                          <div className="pl-5 space-y-2">
                            {disputeSummary.evidence && disputeSummary.evidence.length > 0 ? (
                              disputeSummary.evidence.map((ev, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-white/70 font-light text-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/30"></span>
                                  <span className="capitalize">{ev.type}</span>
                                  <span className="text-white/50">•</span>
                                  <span className="truncate">{ev.fileName || ev.textContent || ev.url || 'Evidence'}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-white/50 font-light text-sm italic">No evidence provided</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <GlassCard variant="light" className="p-4 border-blue-500/30 bg-blue-500/5">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="space-y-1 flex-1">
                          <h3 className="text-white/90 font-light text-sm">What Happens Next?</h3>
                          <p className="text-blue-300/90 text-xs font-light">
                            Our team will review the timeline, delivery logs, and chat transcript. You may be contacted for more information during the review process.
                          </p>
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
