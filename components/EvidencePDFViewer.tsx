'use client'

import { useState, useEffect } from 'react'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'

interface EvidencePDFViewerProps {
  disputeId: string
  evidenceId: string
  fileName?: string
  onClose: () => void
}

export default function EvidencePDFViewer({ 
  disputeId, 
  evidenceId, 
  fileName,
  onClose 
}: EvidencePDFViewerProps) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Disable background scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const loadViewerUrl = async () => {
      try {
        setLoading(true)
        setError(null)

        // Try to get viewer URL from evidence view endpoint
        const response = await fetch(`/api/disputes/${disputeId}/evidence/${evidenceId}/view`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to load evidence')
        }

        const data = await response.json()
        
        if (data.url) {
          setViewerUrl(data.url)
        } else if (data.textContent) {
          // For text content, show in a text area
          setViewerUrl(null)
          setError('Text content - use text viewer instead')
        } else {
          throw new Error('No viewable content found')
        }
      } catch (err: any) {
        console.error('Load viewer URL error:', err)
        setError(err.message || 'Failed to load PDF')
      } finally {
        setLoading(false)
      }
    }

    loadViewerUrl()
  }, [disputeId, evidenceId])

  const handleDownload = () => {
    if (viewerUrl) {
      window.open(viewerUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[99999] isolate" style={{ isolation: 'isolate' }}>
        {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
        <div className="fixed inset-0 bg-white pointer-events-auto" style={{ zIndex: 99998 }}></div>
        {/* Modal */}
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 99999 }}>
          <GlassCard variant="strong" className="p-8 pointer-events-auto">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
              <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-700 font-light">Loading PDF...</p>
          </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[99999] isolate" style={{ isolation: 'isolate' }}>
        {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
        <div className="fixed inset-0 bg-white pointer-events-auto" style={{ zIndex: 99998 }} onClick={onClose}></div>
        {/* Modal */}
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 99999 }}>
          <GlassCard variant="strong" className="p-8 max-w-md pointer-events-auto">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-light text-[#1d1d1f] mb-2">Error Loading PDF</h3>
              <p className="text-[#86868b] text-sm font-light">{error}</p>
            </div>
            <PremiumButton onClick={onClose} className="w-full">Close</PremiumButton>
          </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[99999] isolate" style={{ isolation: 'isolate' }}>
      {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
      <div className="fixed inset-0 bg-white pointer-events-auto" style={{ zIndex: 99998 }} onClick={onClose}></div>
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 99999 }}>
        <div className="bg-white/95 border border-gray-300 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-[#1d1d1f] font-light text-sm">{fileName || 'Evidence PDF'}</h3>
              <p className="text-[#86868b] text-xs font-light">PDF Viewer</p>
            </div>
          </div>
          <div className="flex gap-2">
            <PremiumButton
              variant="ghost"
              onClick={handleDownload}
              className="text-xs px-3 py-1.5 min-h-[32px]"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </PremiumButton>
            <button
              onClick={onClose}
              className="text-[#86868b] hover:text-[#1d1d1f] transition-colors p-1.5 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 relative overflow-hidden">
          {viewerUrl ? (
            <iframe
              src={`${viewerUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full"
              style={{ border: 'none' }}
              title="PDF Viewer"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#86868b] font-light">No content to display</p>
            </div>
          )}
        </div>

        {/* Footer with controls */}
        <div className="p-3 border-t border-gray-200 bg-gray-200/50">
          <div className="flex items-center justify-between text-xs text-[#86868b]">
            <span className="font-light">Use browser controls to navigate</span>
            <span className="font-light">Press ESC or click X to close</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

