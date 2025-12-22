'use client'

import { useState } from 'react'
import DisputeWizard from './DisputeWizard'

interface DisputeHelpButtonProps {
  riftId: string
  itemType: string
  eventDateTz?: Date | null
  hasActiveDispute?: boolean
}

export default function DisputeHelpButton({ 
  riftId, 
  itemType, 
  eventDateTz,
  hasActiveDispute 
}: DisputeHelpButtonProps) {
  const [showWizard, setShowWizard] = useState(false)

  if (hasActiveDispute) {
    return null // Don't show if dispute already exists
  }

  return (
    <>
      <button
        onClick={() => setShowWizard(true)}
        className="text-white/40 hover:text-white/60 text-xs font-light underline transition-colors"
      >
        Help
      </button>

      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl">
            <button
              onClick={() => setShowWizard(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <DisputeWizard
              riftId={riftId}
              itemType={itemType}
              eventDateTz={eventDateTz}
              onClose={() => setShowWizard(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

