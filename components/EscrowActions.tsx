'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PremiumButton from './ui/PremiumButton'
import Card from './ui/Card'
import PaymentModal from './PaymentModal'

type EscrowStatus = 
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
  // Legacy
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'REFUNDED'
  | 'CANCELLED'

interface EscrowTransaction {
  id: string
  status: EscrowStatus
  itemType?: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
  subtotal?: number
  amount?: number
  buyerFee?: number
  currency?: string
}

interface EscrowActionsProps {
  escrow: EscrowTransaction
  currentUserRole: 'BUYER' | 'SELLER' | 'ADMIN'
  userId: string
  isBuyer?: boolean // Explicit buyer flag
  isSeller?: boolean // Explicit seller flag
}

export default function EscrowActions({ escrow, currentUserRole, userId, isBuyer, isSeller }: EscrowActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Determine if user is buyer - use explicit flag or fall back to role
  const userIsBuyer = isBuyer !== undefined ? isBuyer : currentUserRole === 'BUYER'
  const userIsSeller = isSeller !== undefined ? isSeller : currentUserRole === 'SELLER'

  // Debug logging
  console.log('EscrowActions render:', {
    status: escrow.status,
    currentUserRole,
    userId,
    escrowId: escrow.id,
    isBuyer: userIsBuyer,
    isSeller: userIsSeller
  })

  const handleAction = async (action: string, endpoint: string) => {
    setLoading(action)
    try {
      const response = await fetch(`/api/escrows/${escrow.id}/${endpoint}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Action failed')
        return
      }

      router.refresh()
    } catch (error) {
      console.error('Action error:', error)
      alert('Action failed')
    } finally {
      setLoading(null)
    }
  }

  const actions: React.ReactElement[] = []

  // Buyer actions - check if user is buyer (not just role, in case admin is also buyer)
  if (userIsBuyer) {
    // Pay rift or Cancel rift (AWAITING_PAYMENT state)
    // Also check for DRAFT in case of legacy data
    if (escrow.status === 'AWAITING_PAYMENT' || escrow.status === 'DRAFT') {
      console.log('Adding Pay and Cancel buttons for status:', escrow.status)
      actions.push(
        <PremiumButton
          key="pay"
          onClick={() => setShowPaymentModal(true)}
          disabled={loading !== null}
          className="w-full"
          glow
        >
          Pay Rift
        </PremiumButton>
      )
      
      actions.push(
        <PremiumButton
          key="cancel"
          variant="outline"
          onClick={() => {
            if (confirm('Are you sure you want to cancel this rift?')) {
              handleAction('cancel', 'cancel')
            }
          }}
          disabled={loading === 'cancel'}
          className="w-full"
        >
          {loading === 'cancel' ? 'Cancelling...' : 'Cancel Rift'}
        </PremiumButton>
      )
    }

    // Release funds (PROOF_SUBMITTED or UNDER_REVIEW)
    if (escrow.status === 'PROOF_SUBMITTED' || escrow.status === 'UNDER_REVIEW') {
      actions.push(
        <PremiumButton
          key="release"
          onClick={() => handleAction('release', 'release')}
          disabled={loading === 'release'}
          className="w-full"
        >
          {loading === 'release' ? 'Processing...' : 'Release Funds to Seller'}
        </PremiumButton>
      )
      
      // Dispute option
      actions.push(
        <PremiumButton
          key="dispute"
          variant="outline"
          onClick={() => {
            const reason = prompt('Enter dispute reason:')
            if (!reason) return
            handleAction('dispute', 'dispute')
          }}
          disabled={loading === 'dispute'}
          className="w-full"
        >
          {loading === 'dispute' ? 'Processing...' : 'Open Dispute'}
        </PremiumButton>
      )
    }

    // Dispute (FUNDED state - before proof submitted)
    if (escrow.status === 'FUNDED') {
      actions.push(
        <PremiumButton
          key="dispute"
          variant="outline"
          onClick={() => {
            const reason = prompt('Enter dispute reason:')
            if (!reason) return
            handleAction('dispute', 'dispute')
          }}
          disabled={loading === 'dispute'}
          className="w-full"
        >
          {loading === 'dispute' ? 'Processing...' : 'Open Dispute'}
        </PremiumButton>
      )
    }


    // Legacy statuses for backward compatibility
    if (escrow.status === 'IN_TRANSIT') {
      actions.push(
        <PremiumButton
          key="confirm-received"
          onClick={() => handleAction('confirm-received', 'confirm-received')}
          disabled={loading === 'confirm-received'}
          className="w-full"
        >
          {loading === 'confirm-received' ? 'Processing...' : 'Confirm Item Received'}
        </PremiumButton>
      )
    }

    if (escrow.status === 'DELIVERED_PENDING_RELEASE') {
      actions.push(
        <PremiumButton
          key="release-funds"
          onClick={() => handleAction('release-funds', 'release-funds')}
          disabled={loading === 'release-funds'}
          className="w-full"
        >
          {loading === 'release-funds' ? 'Processing...' : 'Release Funds to Seller'}
        </PremiumButton>
      )
    }
  }

  // Seller actions - check if user is seller
  if (userIsSeller) {
    // Submit proof (FUNDED state)
    if (escrow.status === 'FUNDED' || escrow.status === 'AWAITING_SHIPMENT') {
      actions.push(
        <PremiumButton
          key="submit-proof"
          onClick={() => router.push(`/escrows/${escrow.id}/submit-proof`)}
          className="w-full"
        >
          Submit Proof of Delivery
        </PremiumButton>
      )
    }
  }

  // Admin actions for disputes
  if (currentUserRole === 'ADMIN' && escrow.status === 'DISPUTED') {
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
        const response = await fetch(`/api/admin/escrows/${escrow.id}/resolve-dispute`, {
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

        router.refresh()
      } catch (error) {
        console.error('Admin action error:', error)
        alert('Action failed')
      } finally {
        setLoading(null)
      }
    }

    actions.push(
      <div key="admin-actions" className="space-y-2">
        <PremiumButton
          onClick={() => handleAdminAction('FULL_RELEASE')}
          disabled={loading === 'resolve-FULL_RELEASE'}
          className="w-full"
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
          variant="outline"
          onClick={() => handleAdminAction('FULL_REFUND')}
          disabled={loading === 'resolve-FULL_REFUND'}
          className="w-full"
        >
          {loading === 'resolve-FULL_REFUND' ? 'Processing...' : 'Full Refund to Buyer'}
        </PremiumButton>
      </div>
    )
  }

  // Debug: Show info if no actions found (temporary for troubleshooting)
  if (actions.length === 0) {
    console.log('No actions found for:', {
      status: escrow.status,
      currentUserRole,
      escrowId: escrow.id,
      userIsBuyer,
      userIsSeller,
      isAwaitingPayment: escrow.status === 'AWAITING_PAYMENT',
      isDraft: escrow.status === 'DRAFT'
    })
    // Show debug card instead of returning null
    return (
      <Card>
        <h2 className="text-xl font-light text-white mb-6">Actions</h2>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-400/80 text-sm font-light mb-2">
            No actions available
          </p>
          <div className="space-y-1 text-xs text-white/60 font-light">
            <p>Status: <code className="text-white/80">{escrow.status}</code></p>
            <p>Role: <code className="text-white/80">{currentUserRole}</code></p>
            <p>Is Buyer: <code className="text-white/80">{userIsBuyer ? 'Yes' : 'No'}</code></p>
            <p>Is Seller: <code className="text-white/80">{userIsSeller ? 'Yes' : 'No'}</code></p>
            <p>Is AWAITING_PAYMENT: <code className="text-white/80">{escrow.status === 'AWAITING_PAYMENT' ? 'Yes' : 'No'}</code></p>
          </div>
        </div>
      </Card>
    )
  }

  console.log('Rendering actions:', actions.length)

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false)
    router.refresh()
  }

  return (
    <>
      <Card>
        <h2 className="text-xl font-light text-white mb-6">Actions</h2>
        <div className="space-y-3">{actions}</div>
      </Card>
      {showPaymentModal && escrow.currency && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          escrowId={escrow.id}
          amount={escrow.subtotal || escrow.amount}
          buyerTotal={(escrow.subtotal || escrow.amount || 0) + (escrow.buyerFee || 0)}
          currency={escrow.currency}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  )
}

