'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PremiumButton from './ui/PremiumButton'
import Card from './ui/Card'
import PaymentModal from './PaymentModal'
import DisputeWizard from './DisputeWizard'
import { useToast } from './ui/Toast'
import { getAllowedActions, isActionAllowed } from '@/lib/rift-permissions'
import { EscrowStatus } from '@prisma/client'

interface RiftTransaction {
  id: string
  status: EscrowStatus
  itemType?: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES' | 'LICENSE_KEYS'
  subtotal?: number
  amount?: number
  buyerFee?: number
  currency?: string
  eventDateTz?: Date | string | null
  allowsPartialRelease?: boolean
}

interface EscrowActionsProps {
  rift: RiftTransaction
  currentUserRole: 'BUYER' | 'SELLER' | 'ADMIN'
  userId: string
  isBuyer?: boolean // Explicit buyer flag
  isSeller?: boolean // Explicit seller flag
}

export default function EscrowActions({ rift, currentUserRole, userId, isBuyer, isSeller }: EscrowActionsProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDisputeWizard, setShowDisputeWizard] = useState(false)

  // Determine if user is buyer - use explicit flag or fall back to role
  const userIsBuyer = isBuyer !== undefined ? isBuyer : currentUserRole === 'BUYER'
  const userIsSeller = isSeller !== undefined ? isSeller : currentUserRole === 'SELLER'

  // Debug logging
  console.log('EscrowActions render:', {
    status: rift.status,
    currentUserRole,
    userId,
    escrowId: rift.id,
    isBuyer: userIsBuyer,
    isSeller: userIsSeller
  })

  const handleAction = async (action: string, endpoint: string, body?: any) => {
    setLoading(action)
    try {
      const response = await fetch(`/api/rifts/${rift.id}/${endpoint}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Action failed', 'error')
        return
      }

      showToast('Action completed successfully', 'success')
      router.refresh()
    } catch (error) {
      console.error('Action error:', error)
      showToast('Action failed. Please try again.', 'error')
    } finally {
      setLoading(null)
    }
  }

  const actions: React.ReactElement[] = []

  // Helper function to get seller proof button text based on item type
  const getSellerProofButtonText = (): string => {
    switch (rift.itemType) {
      case 'DIGITAL':
        return 'Add File/PDF to Vault'
      case 'TICKETS':
        return 'Add Ticket Proof to Vault'
      case 'SERVICES':
        return 'Add Completion Proof to Vault'
      case 'PHYSICAL':
        return 'Add Shipment Proof to Vault'
      default:
        return 'Add Proof to Vault'
    }
  }

  // ============================================
  // PHASE 3: Category-specific actions
  // ============================================

  // DIGITAL GOODS AND LICENSE KEYS
  if (rift.itemType === 'DIGITAL' || rift.itemType === 'LICENSE_KEYS') {

    // Buyer: View Proof - Only if proof has been submitted
    // Permission system handles both new (PROOF_SUBMITTED, UNDER_REVIEW) and legacy (DELIVERED_PENDING_RELEASE) statuses
    if (userIsBuyer && isActionAllowed(rift.status as EscrowStatus, 'BUYER', 'ACCESS_VAULT')) {
      // For DIGITAL, route to delivery page. For LICENSE_KEYS, vault assets are shown on the rift page via DeliveryStatus
      if (rift.itemType === 'DIGITAL') {
        actions.push(
          <PremiumButton
              key="view-proof"
              variant="ghost"
              onClick={() => router.push(`/rifts/${rift.id}/delivery`)}
              className="w-full text-sm"
            >
              View Proof →
            </PremiumButton>
        )
      }
      // For LICENSE_KEYS, vault assets are displayed on the main page via DeliveryStatus component, so no separate button needed
    }
  }

  // SERVICES
  if (rift.itemType === 'SERVICES') {

    // Buyer: Release All Funds - Only if proof has been submitted
    // Permission system handles both new (PROOF_SUBMITTED, UNDER_REVIEW) and legacy (DELIVERED_PENDING_RELEASE) statuses
    if (userIsBuyer && isActionAllowed(rift.status as EscrowStatus, 'BUYER', 'ACCEPT_PROOF')) {
      // Permission check is sufficient - it handles PROOF_SUBMITTED, UNDER_REVIEW, and DELIVERED_PENDING_RELEASE
      actions.push(
        <PremiumButton
            key="confirm-completion"
            variant="outline"
            onClick={() => {
              if (confirm('Release all funds to the seller? This will complete the transaction.')) {
                handleAction('confirm-completion', 'services/confirm-completion')
              }
            }}
            disabled={loading === 'confirm-completion'}
            className="w-full"
          >
            {loading === 'confirm-completion' ? 'Processing...' : 'Release All Funds'}
          </PremiumButton>
      )
    }
  }

  // TICKETS
  // Note: Tickets use the same "Release Payment" button as other item types (handled below)
  if (rift.itemType === 'TICKETS') {
    // No special ticket handling needed - use the standard "Release Payment" button
  }

  // ============================================
  // Legacy actions (existing code)
  // ============================================

  // Buyer actions - check if user is buyer (not just role, in case admin is also buyer)
  if (userIsBuyer) {
    // Pay rift or Cancel rift (AWAITING_PAYMENT state)
    // Also check for DRAFT in case of legacy data
    if (rift.status === 'AWAITING_PAYMENT' || rift.status === 'DRAFT') {
      console.log('Adding Pay and Cancel buttons for status:', rift.status)
      actions.push(
        <PremiumButton
          key="pay"
          variant="outline"
          onClick={() => setShowPaymentModal(true)}
          disabled={loading !== null}
          className="w-full bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-blue-400/30 hover:from-blue-500/30 hover:to-blue-600/30"
        >
          Pay Rift
        </PremiumButton>
      )
      
      actions.push(
        <PremiumButton
          key="cancel"
          variant="ghost"
          onClick={() => {
            if (confirm('Are you sure you want to cancel this rift?')) {
              handleAction('cancel', 'cancel')
            }
          }}
          disabled={loading === 'cancel'}
          className="w-full"
        >
          {loading === 'cancel' ? 'Cancelling...' : 'Cancel'}
        </PremiumButton>
      )
    }

    // Release funds early - Only if allowed by permissions
    // Don't show if already RELEASED, PAYOUT_SCHEDULED, or PAID_OUT
    // Don't show for service rifts with milestone-based releases (use MilestoneCard instead)
    // Permission system handles both new (PROOF_SUBMITTED, UNDER_REVIEW) and legacy (DELIVERED_PENDING_RELEASE) statuses
    const canReleaseFunds = 
      isActionAllowed(rift.status as EscrowStatus, 'BUYER', 'ACCEPT_PROOF') &&
      !['RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'RESOLVED', 'CANCELED', 'CANCELLED'].includes(rift.status) &&
      !(rift.itemType === 'SERVICES' && rift.allowsPartialRelease)
    
    if (canReleaseFunds) {
      actions.push(
        <PremiumButton
          key="release"
          variant="outline"
          onClick={() => handleAction('release', 'release')}
          disabled={loading === 'release'}
          className="w-full"
        >
          {loading === 'release' ? 'Processing...' : 'Release Payment'}
        </PremiumButton>
      )
    }

    // Dispute option - Only if allowed by permissions (for both buyers and sellers)
    // Permission system handles both new and legacy statuses (FUNDED, AWAITING_SHIPMENT, IN_TRANSIT, PROOF_SUBMITTED, UNDER_REVIEW, DELIVERED_PENDING_RELEASE)
    const userRole = userIsBuyer ? 'BUYER' : userIsSeller ? 'SELLER' : currentUserRole
    if (isActionAllowed(rift.status as EscrowStatus, userRole, 'OPEN_DISPUTE')) {
      // Permission check is sufficient - it handles all appropriate statuses
      actions.push(
        <PremiumButton
          key="dispute"
          variant="outline"
          onClick={() => setShowDisputeWizard(true)}
          disabled={loading === 'dispute'}
          className="w-full text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border-red-400/30 hover:border-red-400/50"
        >
          Open Dispute
        </PremiumButton>
      )
    }


    // Legacy statuses for backward compatibility
    if (rift.status === 'IN_TRANSIT') {
      // For non-physical items, show early release button
      if (rift.itemType && rift.itemType !== 'PHYSICAL') {
        actions.push(
          <PremiumButton
            key="release-funds-early"
            variant="outline"
            onClick={() => handleAction('release-funds', 'release-funds')}
            disabled={loading === 'release-funds'}
            className="w-full"
          >
            {loading === 'release-funds' ? 'Processing...' : 'Release Payment'}
          </PremiumButton>
        )
      }
    }

    // Legacy status: DELIVERED_PENDING_RELEASE
    if (rift.status === 'DELIVERED_PENDING_RELEASE') {
      actions.push(
        <PremiumButton
          key="release-funds"
          variant="outline"
          onClick={() => handleAction('release-funds', 'release-funds')}
          disabled={loading === 'release-funds'}
          className="w-full"
        >
          {loading === 'release-funds' ? 'Processing...' : 'Release Payment'}
        </PremiumButton>
      )
    }
  }

  // Seller actions - Unified "Add Proof to Vault" action
  if (userIsSeller) {
    // Add proof to vault - Only if allowed by permissions
    // Permission system handles both new (FUNDED) and legacy (AWAITING_SHIPMENT, IN_TRANSIT) statuses
    const canUploadProof = isActionAllowed(rift.status as EscrowStatus, 'SELLER', 'UPLOAD_PROOF')
    console.log('Seller upload proof check:', {
      status: rift.status,
      userIsSeller,
      canUploadProof,
      allowedActions: getAllowedActions(rift.status as EscrowStatus, 'SELLER'),
    })
    
    if (canUploadProof) {
      // Permission check is sufficient - it handles FUNDED, AWAITING_SHIPMENT, and IN_TRANSIT
      actions.push(
        <PremiumButton
          key="add-proof-to-vault"
          variant="outline"
          onClick={() => router.push(`/rifts/${rift.id}/submit-proof`)}
          className="w-full bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-blue-400/30 hover:from-blue-500/30 hover:to-blue-600/30"
        >
          {getSellerProofButtonText()}
        </PremiumButton>
      )
    }
  }

  // Admin actions for disputes
  if (currentUserRole === 'ADMIN' && rift.status === 'DISPUTED') {
    const handleAdminAction = async (resolution: 'FULL_RELEASE' | 'PARTIAL_REFUND' | 'FULL_REFUND') => {
      let partialAmount: number | undefined
      if (resolution === 'PARTIAL_REFUND') {
        const amountStr = prompt('Enter partial refund amount:')
        if (!amountStr) return
        partialAmount = parseFloat(amountStr)
        if (isNaN(partialAmount) || partialAmount <= 0) {
          alert('Invalid amount')
          return
        }
      }
      
      const note = prompt('Enter admin resolution note:')
      if (!note) return
      
      setLoading(`resolve-${resolution}`)
      try {
        const response = await fetch(`/api/admin/rifts/${rift.id}/resolve-dispute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            resolution, 
            partialRefundAmount: partialAmount,
            adminNotes: note 
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          alert(error.error || 'Action failed')
          return
        }

        showToast('Dispute resolved successfully', 'success')
        router.refresh()
      } catch (error) {
        console.error('Admin action error:', error)
        showToast('Failed to resolve dispute. Please try again.', 'error')
      } finally {
        setLoading(null)
      }
    }

    actions.push(
      <div key="admin-actions" className="space-y-2">
        <PremiumButton
          variant="outline"
          onClick={() => handleAdminAction('FULL_RELEASE')}
          disabled={loading === 'resolve-FULL_RELEASE'}
          className="w-full bg-gradient-to-r from-green-500/20 to-green-600/20 border-green-400/30 hover:from-green-500/30 hover:to-green-600/30"
        >
          {loading === 'resolve-FULL_RELEASE' ? 'Processing...' : 'Full Release to Seller'}
        </PremiumButton>
        <PremiumButton
          variant="outline"
          onClick={() => handleAdminAction('PARTIAL_REFUND')}
          disabled={loading === 'resolve-PARTIAL_REFUND'}
          className="w-full"
        >
          {loading === 'resolve-PARTIAL_REFUND' ? 'Processing...' : 'Partial Refund'}
        </PremiumButton>
        <PremiumButton
          variant="ghost"
          onClick={() => handleAdminAction('FULL_REFUND')}
          disabled={loading === 'resolve-FULL_REFUND'}
          className="w-full text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
        >
          {loading === 'resolve-FULL_REFUND' ? 'Processing...' : 'Full Refund to Buyer'}
        </PremiumButton>
      </div>
    )
  }

  console.log('Rendering actions:', actions.length)

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false)
    router.refresh()
  }

  const handleDisputeWizardClose = () => {
    setShowDisputeWizard(false)
    router.refresh()
  }

  // Disable background scroll while modal is open
  useEffect(() => {
    if (!showDisputeWizard) return
    
    // Lock body scroll
    const prevOverflow = document.body.style.overflow
    const prevPosition = document.body.style.position
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    
    // Hide all other content by adding a class to body
    document.body.classList.add('modal-open')
    
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.position = prevPosition
      document.body.style.width = ''
      document.body.classList.remove('modal-open')
    }
  }, [showDisputeWizard])

  return (
    <>
      {!showDisputeWizard && (
        <Card>
          <h2 className="text-xl font-light text-white mb-6">Actions</h2>
          {actions.length > 0 ? (
            <div className="space-y-3">{actions}</div>
          ) : (
            <p className="text-white/60 font-light text-sm">No actions required at this time</p>
          )}
        </Card>
      )}
      {showPaymentModal && rift.currency && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          escrowId={rift.id}
          amount={rift.subtotal || rift.amount}
          buyerTotal={(rift.subtotal || rift.amount || 0) + (rift.buyerFee || 0)}
          currency={rift.currency}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showDisputeWizard && rift.itemType && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop - rendered first, covers everything */}
          <div
            className="fixed inset-0 bg-black pointer-events-auto"
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
            onClick={handleDisputeWizardClose}
          />
          {/* Modal Container */}
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
              onClick={handleDisputeWizardClose}
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
                  onClose={handleDisputeWizardClose}
                />
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

