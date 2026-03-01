'use client'

import { useState, useEffect } from 'react'
import DisputeWizard from './DisputeWizard'

interface DisputeHelpButtonProps {
  riftId: string
  itemType: string
  eventDateTz?: Date | null
  hasActiveDispute?: boolean
  riftStatus?: string
}

export default function DisputeHelpButton({ 
  riftId, 
  itemType, 
  eventDateTz,
  hasActiveDispute,
  riftStatus
}: DisputeHelpButtonProps) {
  const [showWizard, setShowWizard] = useState(false)

  // Disable background scroll while modal is open
  useEffect(() => {
    if (!showWizard) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showWizard])

  // Statuses that don't allow disputes
  const disputeBlockedStatuses = ['DRAFT', 'AWAITING_PAYMENT', 'CANCELLED', 'CANCELED', 'RELEASED', 'RESOLVED']
  
  if (hasActiveDispute) {
    return null // Don't show if dispute already exists
  }
  
  // Don't show dispute button if status doesn't allow disputes
  if (riftStatus && disputeBlockedStatuses.includes(riftStatus)) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setShowWizard(true)}
        className="text-gray-400 hover:text-[#86868b] text-xs font-light underline transition-colors"
      >
        Help
      </button>

      {showWizard && (
        <div className="fixed inset-0 z-[99999] isolate" style={{ isolation: 'isolate' }}>
          {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
          <div
            className="fixed inset-0 bg-white pointer-events-auto"
            style={{ zIndex: 99998 }}
            onClick={() => setShowWizard(false)}
          />
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-6 pointer-events-none" style={{ zIndex: 99999 }}>
            <div className="relative w-[min(980px,92vw)] max-h-[86vh] overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-2xl pointer-events-auto">
              <button
                onClick={() => setShowWizard(false)}
                className="absolute top-4 right-4 z-20 text-[#86868b] hover:text-[#1d1d1f] transition-colors p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="overflow-y-auto max-h-[86vh]">
                <DisputeWizard
                  riftId={riftId}
                  itemType={itemType}
                  eventDateTz={eventDateTz}
                  onClose={() => setShowWizard(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

