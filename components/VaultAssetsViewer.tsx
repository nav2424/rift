'use client'

import { useState, useEffect } from 'react'
import { useToast } from './ui/Toast'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'

interface VaultAsset {
  id: string
  assetType: string
  fileName?: string
  createdAt: string
  scanStatus?: string
  qualityScore?: number
  isRevealed?: boolean // For license keys
}

interface VaultAssetsViewerProps {
  riftId: string
  isBuyer: boolean
}

export default function VaultAssetsViewer({ riftId, isBuyer }: VaultAssetsViewerProps) {
  const { showToast } = useToast()
  const [assets, setAssets] = useState<VaultAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [revealing, setRevealing] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({})

  useEffect(() => {
    loadAssets()
  }, [riftId])

  // Disable background scroll while modal is open
  useEffect(() => {
    if (viewing) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [viewing])

  const loadAssets = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/rifts/${riftId}/vault`)
      
      if (!response.ok) {
        if (response.status === 403) {
          // Not accessible yet (proof not submitted)
          setAssets([])
          return
        }
        
        // Try to get error message from response
        let errorMessage = 'Failed to load assets'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setAssets(data.assets || [])
    } catch (error: any) {
      console.error('Load assets error:', error)
      const errorMessage = error?.message || 'Failed to load delivery assets'
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleViewAsset = async (asset: VaultAsset) => {
    try {
      if (asset.assetType === 'LICENSE_KEY') {
        // Handle license key reveal
        if (revealedKeys[asset.id]) {
          // Already revealed, just show it
          alert(`License Key:\n\n${revealedKeys[asset.id]}`)
          return
        }

        setRevealing(asset.id)
        const response = await fetch(`/api/rifts/${riftId}/vault`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: asset.id,
            action: 'reveal_license_key',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          showToast(error.error || 'Failed to reveal license key', 'error')
          return
        }

        const data = await response.json()
        setRevealedKeys(prev => ({ ...prev, [asset.id]: data.licenseKey }))
        alert(`License Key:\n\n${data.licenseKey}\n\n⚠️ Please save this key. You won't be able to view it again.`)
      } else if (asset.assetType === 'TRACKING') {
        // Handle tracking number
        const response = await fetch(`/api/rifts/${riftId}/vault`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: asset.id,
            action: 'open',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          showToast(error.error || 'Failed to load tracking number', 'error')
          return
        }

        const data = await response.json()
        alert(`Tracking Number:\n\n${data.content || data.trackingNumber}`)
      } else if (asset.assetType === 'TEXT_INSTRUCTIONS') {
        // Handle text instructions
        const response = await fetch(`/api/rifts/${riftId}/vault`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: asset.id,
            action: 'open',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          showToast(error.error || 'Failed to load instructions', 'error')
          return
        }

        const data = await response.json()
        alert(`Instructions:\n\n${data.content || data.textContent}`)
      } else {
        // Handle files (FILE, TICKET_PROOF, URL)
        const response = await fetch(`/api/rifts/${riftId}/vault`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: asset.id,
            action: 'open',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          showToast(error.error || 'Failed to open file', 'error')
          return
        }

        const data = await response.json()
        if (data.url) {
          setViewing(asset.id)
          setViewerUrl(data.url)
        } else {
          showToast('No viewable content available', 'error')
        }
      }
    } catch (error: any) {
      console.error('View asset error:', error)
      showToast('Failed to view asset', 'error')
    } finally {
      setRevealing(null)
    }
  }

  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FILE: 'File',
      LICENSE_KEY: 'License Key',
      TRACKING: 'Tracking Number',
      TICKET_PROOF: 'Ticket Proof',
      URL: 'URL',
      TEXT_INSTRUCTIONS: 'Instructions',
    }
    return labels[type] || type
  }

  const downloadFile = (url: string, fileName?: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || 'download'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <GlassCard className="p-4">
        <div className="text-white/60 font-light text-sm">Loading delivery assets...</div>
      </GlassCard>
    )
  }

  if (assets.length === 0) {
    return (
      <GlassCard className="p-4">
        <div className="text-white/60 font-light text-sm">
          {isBuyer ? 'No delivery assets available yet. Seller has not submitted proof.' : 'No assets uploaded yet.'}
        </div>
      </GlassCard>
    )
  }

  return (
    <>
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-light text-white/90 uppercase tracking-wider">
          Delivery Assets
        </h3>

        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <span className="text-white font-light text-sm">
                      {getAssetTypeLabel(asset.assetType)}
                    </span>
                    {asset.fileName && (
                      <span className="text-white/50 text-xs font-mono truncate max-w-xs">
                        {asset.fileName}
                      </span>
                    )}
                    {asset.scanStatus && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        asset.scanStatus === 'PASS' 
                          ? 'text-green-400/90 bg-green-400/10 border border-green-400/20' 
                          : asset.scanStatus === 'FAIL'
                          ? 'text-red-400/90 bg-red-400/10 border border-red-400/20'
                          : 'text-yellow-400/90 bg-yellow-400/10 border border-yellow-400/20'
                      }`}>
                        {asset.scanStatus}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/35 font-light">
                    {new Date(asset.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {asset.assetType === 'LICENSE_KEY' && revealedKeys[asset.id] ? (
                    <PremiumButton
                      variant="outline"
                      onClick={() => alert(`License Key:\n\n${revealedKeys[asset.id]}`)}
                      className="text-xs px-4 py-2 min-h-[32px]"
                    >
                      View Key
                    </PremiumButton>
                  ) : (
                    <PremiumButton
                      variant="outline"
                      onClick={() => handleViewAsset(asset)}
                      disabled={revealing === asset.id || viewing === asset.id}
                      className="text-xs px-4 py-2 min-h-[32px]"
                    >
                      {revealing === asset.id 
                        ? 'Revealing...' 
                        : asset.assetType === 'LICENSE_KEY'
                        ? 'Reveal Key'
                        : asset.assetType === 'TRACKING'
                        ? 'View Tracking'
                        : asset.assetType === 'TEXT_INSTRUCTIONS'
                        ? 'View Instructions'
                        : 'View'}
                    </PremiumButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* File Viewer Modal */}
      {viewing && viewerUrl && (
        <div className="fixed inset-0 z-[99999] isolate" style={{ isolation: 'isolate' }}>
          {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
          <div className="fixed inset-0 bg-black pointer-events-auto" style={{ zIndex: 99998 }} onClick={() => setViewing(null)}></div>
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 99999 }}>
            <div className="bg-black/95 border border-white/20 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-light text-sm">File Viewer</h3>
              <div className="flex gap-2">
                <PremiumButton
                  variant="ghost"
                  onClick={() => downloadFile(viewerUrl)}
                  className="text-xs px-3 py-1.5 min-h-[32px]"
                >
                  Download
                </PremiumButton>
                <button
                  onClick={() => {
                    setViewing(null)
                    setViewerUrl(null)
                  }}
                  className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <iframe
              src={viewerUrl}
              className="flex-1 w-full"
              style={{ border: 'none' }}
            />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

