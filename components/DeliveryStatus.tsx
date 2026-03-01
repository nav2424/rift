'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import VaultAssetsViewer from './VaultAssetsViewer'

interface DeliveryStatusProps {
  riftId: string
  itemType: 'PHYSICAL' | 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES'
  status: string
}

export default function DeliveryStatus({ riftId, itemType, status }: DeliveryStatusProps) {
  const { data: session } = useSession()
  const [rift, setRift] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRift = async () => {
      try {
        const response = await fetch(`/api/rifts/${riftId}`)
        if (response.ok) {
          const data = await response.json()
          setRift(data)
        }
      } catch (error) {
        console.error('Load rift error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRift()
  }, [riftId])

  if (loading || !rift || !session) {
    return (
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="text-[#86868b] font-light text-sm">Loading delivery status...</div>
      </div>
    )
  }

  // Check if proof has been submitted (vault is accessible)
  // Include legacy status DELIVERED_PENDING_RELEASE which maps to PROOF_SUBMITTED
  const canViewVault = ['PROOF_SUBMITTED', 'UNDER_REVIEW', 'RELEASED', 'PAYOUT_SCHEDULED', 'PAID_OUT', 'DELIVERED_PENDING_RELEASE'].includes(status)
  const isBuyer = rift.buyerId === session.user.id

  // For buyers, show vault assets if proof has been submitted
  if (isBuyer && canViewVault) {
    return <VaultAssetsViewer riftId={riftId} isBuyer={true} />
  }

  // For sellers, show simple status message
  if (!isBuyer) {
    return (
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
        <h3 className="text-sm font-medium text-gray-800 uppercase tracking-wide">
          Delivery Status
        </h3>
        {canViewVault ? (
          <div className="text-green-400/80 text-sm">✓ Proof submitted - awaiting buyer review</div>
        ) : (
          <div className="text-[#86868b] text-sm">Proof not yet submitted</div>
        )}
      </div>
    )
  }

  // For buyers before proof is submitted
  return (
    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
      <h3 className="text-sm font-medium text-gray-800 uppercase tracking-wide">
        Delivery Status
      </h3>
      <div className="text-[#86868b] text-sm">Awaiting seller to submit proof</div>
    </div>
  )
}
