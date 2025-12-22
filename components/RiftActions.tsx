'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PremiumButton from './ui/PremiumButton'
import Card from './ui/Card'
import PaymentModal from './PaymentModal'
import { useToast } from './ui/Toast'

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

interface RiftTransaction {
  id: string
  status: EscrowStatus
  itemType?: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
  subtotal?: number
  amount?: number
  buyerFee?: number
  currency?: string
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

  const handleAction = async (action: string, endpoint: string) => {
    setLoading(action)
    try {
      const response = await fetch(`/api/rifts/${rift.id}/${endpoint}`, {
        method: 'POST',
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

  // ============================================
  // PHASE 3: Category-specific actions
  // ============================================

  // DIGITAL GOODS
  if (rift.itemType === 'DIGITAL') {
    // Seller: Upload Delivery
    if (userIsSeller && (rift.status === 'FUNDED' || rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW')) {
      actions.push(
        <PremiumButton
          key="upload-delivery"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '*/*'
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (!file) return

              setLoading('upload-delivery')
              try {
                const formData = new FormData()
                formData.append('file', file)

                const response = await fetch(`/api/rifts/${rift.id}/delivery/upload`, {
                  method: 'POST',
                  body: formData,
                })

                if (!response.ok) {
                  const error = await response.json()
                  showToast(error.error || 'Upload failed', 'error')
                  return
                }

                showToast('Delivery uploaded successfully', 'success')
                router.refresh()
              } catch (error) {
                console.error('Upload error:', error)
                showToast('Upload failed. Please try again.', 'error')
              } finally {
                setLoading(null)
              }
            }
            input.click()
          }}
          disabled={loading === 'upload-delivery'}
          className="w-full"
        >
          {loading === 'upload-delivery' ? 'Uploading...' : 'Upload Delivery'}
        </PremiumButton>
      )
    }

    // Buyer: Open Delivery, Confirm Receipt
    if (userIsBuyer) {
      if (rift.status === 'DELIVERED_PENDING_RELEASE' || rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW') {
        actions.push(
          <PremiumButton
            key="open-delivery"
            onClick={() => router.push(`/rifts/${rift.id}/delivery`)}
            className="w-full"
            glow
          >
            Open Delivery
          </PremiumButton>
        )

        actions.push(
          <PremiumButton
            key="confirm-receipt-digital"
            variant="outline"
            onClick={() => {
              if (confirm('Confirm you have received the digital delivery? This confirmation is final.')) {
                handleAction('confirm-receipt', 'delivery/confirm-receipt')
              }
            }}
            disabled={loading === 'confirm-receipt'}
            className="w-full"
          >
            {loading === 'confirm-receipt' ? 'Processing...' : 'Confirm Receipt'}
          </PremiumButton>
        )
      }
    }
  }

  // SERVICES
  if (rift.itemType === 'SERVICES') {
    // Seller: Mark Delivered
    if (userIsSeller && (rift.status === 'FUNDED' || rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW')) {
      actions.push(
        <PremiumButton
          key="mark-delivered"
          onClick={() => handleAction('mark-delivered', 'services/mark-delivered')}
          disabled={loading === 'mark-delivered'}
          className="w-full"
        >
          {loading === 'mark-delivered' ? 'Processing...' : 'Mark Delivered'}
        </PremiumButton>
      )
    }

    // Buyer: Confirm Completion
    if (userIsBuyer && rift.status === 'DELIVERED_PENDING_RELEASE') {
      actions.push(
        <PremiumButton
          key="confirm-completion"
          onClick={() => {
            if (confirm('Confirm the service is complete? This confirmation is final.')) {
              handleAction('confirm-completion', 'services/confirm-completion')
            }
          }}
          disabled={loading === 'confirm-completion'}
          className="w-full"
          glow
        >
          {loading === 'confirm-completion' ? 'Processing...' : 'Confirm Completion'}
        </PremiumButton>
      )
    }
  }

  // TICKETS
  if (rift.itemType === 'TICKETS') {
    // Seller: Claim Transfer Sent
    if (userIsSeller && (rift.status === 'FUNDED' || rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW')) {
      actions.push(
        <PremiumButton
          key="claim-transfer-sent"
          onClick={async () => {
            const provider = prompt('Enter ticket provider (ticketmaster, axs, seatgeek, stubhub, or other):')
            if (!provider) return

            setLoading('claim-transfer-sent')
            try {
              const response = await fetch(`/api/rifts/${rift.id}/tickets/claim-transfer-sent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
              })

              if (!response.ok) {
                const error = await response.json()
                showToast(error.error || 'Action failed', 'error')
                return
              }

              showToast('Transfer marked as sent', 'success')
              router.refresh()
            } catch (error) {
              console.error('Claim transfer error:', error)
              showToast('Action failed. Please try again.', 'error')
            } finally {
              setLoading(null)
            }
          }}
          disabled={loading === 'claim-transfer-sent'}
          className="w-full"
        >
          {loading === 'claim-transfer-sent' ? 'Processing...' : 'I Sent the Transfer'}
        </PremiumButton>
      )
    }

    // Buyer: Confirm Receipt
    if (userIsBuyer && rift.status === 'DELIVERED_PENDING_RELEASE') {
      actions.push(
        <PremiumButton
          key="confirm-ticket-receipt"
          onClick={() => {
            if (confirm(
              'Confirm you received the ticket in your official ticketing app/account?\n\n' +
              '⚠️ This confirmation is final and is used as transaction proof.'
            )) {
              handleAction('confirm-ticket-receipt', 'tickets/confirm-receipt')
            }
          }}
          disabled={loading === 'confirm-ticket-receipt'}
          className="w-full"
          glow
        >
          {loading === 'confirm-ticket-receipt' ? 'Processing...' : 'Confirm Receipt in App'}
        </PremiumButton>
      )
    }
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
    // Don't show if already RELEASED, RELEASED, PAYOUT_SCHEDULED, or PAID_OUT
    const canReleaseFunds = 
      (rift.status === 'PROOF_SUBMITTED' || rift.status === 'UNDER_REVIEW') &&
      !['RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT'].includes(rift.status)
    
    if (canReleaseFunds) {
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

    // Dispute (PAID state - before proof submitted)
    if (rift.status === 'FUNDED') {
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
    if (rift.status === 'IN_TRANSIT') {
      // For non-physical items, show early release button
      if (rift.itemType && rift.itemType !== 'PHYSICAL') {
        actions.push(
          <PremiumButton
            key="release-funds-early"
            onClick={() => handleAction('release-funds', 'release-funds')}
            disabled={loading === 'release-funds'}
            className="w-full"
            glow
          >
            {loading === 'release-funds' ? 'Processing...' : 'Release Funds Early'}
          </PremiumButton>
        )
      }
      
      // For all items, show confirm received button
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

    // Legacy status: DELIVERED_PENDING_RELEASE
    // Don't show if already RELEASED
    if (rift.status === 'DELIVERED_PENDING_RELEASE' && rift.status !== 'RELEASED') {
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
    // Submit proof (PAID state)
    if (rift.status === 'FUNDED' || rift.status === 'AWAITING_SHIPMENT') {
      actions.push(
        <PremiumButton
          key="submit-proof"
          onClick={() => router.push(`/rifts/${rift.id}/submit-proof`)}
          className="w-full"
        >
          Submit Proof of Delivery
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

  // If no actions available, don't show the Actions section at all
  if (actions.length === 0) {
    return null
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
    </>
  )
}

