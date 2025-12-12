'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PremiumButton from './ui/PremiumButton'
import Card from './ui/Card'

type EscrowStatus = 
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CANCELLED'

interface EscrowTransaction {
  id: string
  status: EscrowStatus
  itemType?: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
}

interface EscrowActionsProps {
  escrow: EscrowTransaction
  currentUserRole: 'BUYER' | 'SELLER' | 'ADMIN'
  userId: string
}

export default function EscrowActions({ escrow, currentUserRole, userId }: EscrowActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

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

  // Buyer actions
  if (currentUserRole === 'BUYER') {
    if (escrow.status === 'AWAITING_PAYMENT') {
      actions.push(
        <PremiumButton
          key="mark-paid"
          onClick={() => handleAction('mark-paid', 'mark-paid')}
          disabled={loading === 'mark-paid'}
          className="w-full"
        >
          {loading === 'mark-paid' ? 'Processing...' : 'Mark as Paid'}
        </PremiumButton>
      )
    }

    if (escrow.status === 'IN_TRANSIT') {
      // For non-physical items, show option to release funds early
      if (escrow.itemType && escrow.itemType !== 'PHYSICAL') {
        actions.push(
          <PremiumButton
            key="release-funds-early"
            onClick={() => handleAction('release-funds-early', 'release-funds')}
            disabled={loading === 'release-funds-early'}
            className="w-full"
          >
            {loading === 'release-funds-early' ? 'Processing...' : 'Release Funds Early (Optional)'}
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

    if (['AWAITING_PAYMENT', 'AWAITING_SHIPMENT'].includes(escrow.status)) {
      actions.push(
        <PremiumButton
          key="cancel"
          variant="outline"
          onClick={() => {
            if (confirm('Are you sure you want to cancel this escrow?')) {
              handleAction('cancel', 'cancel')
            }
          }}
          disabled={loading === 'cancel'}
          className="w-full"
        >
          {loading === 'cancel' ? 'Cancelling...' : 'Cancel Escrow'}
        </PremiumButton>
      )
    }
  }

  // Admin actions for disputes
  if (currentUserRole === 'ADMIN' && escrow.status === 'DISPUTED') {
    const handleAdminAction = async (action: 'release' | 'refund') => {
      const note = prompt('Enter admin resolution note:')
      if (!note) return
      
      setLoading(`resolve-${action}`)
      try {
        const response = await fetch(`/api/admin/escrows/${escrow.id}/resolve-dispute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, adminNote: note }),
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
          onClick={() => handleAdminAction('release')}
          disabled={loading === 'resolve-release'}
          className="w-full"
        >
          {loading === 'resolve-release' ? 'Processing...' : 'Release Funds to Seller'}
        </PremiumButton>
        <PremiumButton
          variant="outline"
          onClick={() => handleAdminAction('refund')}
          disabled={loading === 'resolve-refund'}
          className="w-full"
        >
          {loading === 'resolve-refund' ? 'Processing...' : 'Refund Buyer'}
        </PremiumButton>
      </div>
    )
  }

  if (actions.length === 0) {
    return null
  }

  return (
    <Card>
      <h2 className="text-xl font-light text-white mb-6">Actions</h2>
      <div className="space-y-3">{actions}</div>
    </Card>
  )
}

