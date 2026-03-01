'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

interface VaultAsset {
  id: string
  assetType: string
  fileName?: string
  sha256: string
  mimeDetected?: string
  scanStatus: string
  qualityScore?: number
  metadataJson?: any
  storagePath?: string
  url?: string
  textContent?: string
  trackingNumber?: string
  createdAt: string
  buyerAccessHistory: Array<{
    eventType: string
    timestampUtc: string
    ipHash?: string
    sessionId?: string
  }>
}

interface VaultData {
  rift: {
    id: string
    riftNumber: number
    status: string
    itemType: string
    itemTitle: string
    buyer: { id: string; email: string; name?: string }
    seller: { id: string; email: string; name?: string }
  }
  assets: VaultAsset[]
  events: Array<{
    id: string
    eventType: string
    actorRole: string
    timestampUtc: string
    asset?: { id: string; assetType: string; fileName?: string }
  }>
  reviews: Array<{
    id: string
    status: string
    createdAt: string
    reviewer?: { name?: string; email: string }
  }>
}

export default function AdminVaultPage() {
  const params = useParams()
  const router = useRouter()
  const riftId = params?.riftId as string
  const [vaultData, setVaultData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingAsset, setViewingAsset] = useState<string | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [duplicateCheck, setDuplicateCheck] = useState<any>(null)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [hashSearchResults, setHashSearchResults] = useState<any>(null)

  useEffect(() => {
    if (riftId) {
      loadVaultData()
    }
  }, [riftId])

  // Disable background scroll while modal is open
  useEffect(() => {
    if (viewingAsset) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [viewingAsset])

  const loadVaultData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/vault/${riftId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Unauthorized - Please log in as admin')
          return
        }
        if (response.status === 404) {
          setError('Rift not found')
          return
        }
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load vault data')
        return
      }

      const data = await response.json()
      setVaultData(data)
    } catch (err: any) {
      console.error('Error loading vault data:', err)
      setError(err.message || 'Failed to load vault data')
    } finally {
      setLoading(false)
    }
  }

  const viewAsset = async (assetId: string) => {
    try {
      // First check what type of asset it is
      const asset = vaultData?.assets.find(a => a.id === assetId)
      
      // For license keys, we need to use the POST endpoint to decrypt
      if (asset?.assetType === 'LICENSE_KEY') {
        const response = await fetch(`/api/admin/vault/${riftId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ assetId, action: 'view' }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to load license key')
          return
        }

        const data = await response.json()
        if (data.licenseKey) {
          alert(`License Key:\n\n${data.licenseKey}`)
        }
        return
      }

      // For other assets, use the viewer endpoint
      const response = await fetch(`/api/admin/vault/assets/${assetId}/viewer`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to load asset')
        return
      }

      const data = await response.json()
      
      // Handle text content and tracking numbers
      if (data.textContent) {
        alert(`Text Content:\n\n${data.textContent}`)
        return
      }
      if (data.trackingNumber) {
        alert(`Tracking Number: ${data.trackingNumber}`)
        return
      }

      // For files with URLs, show in viewer
      if (data.viewerUrl || data.url) {
        setViewingAsset(assetId)
        setViewerUrl(data.viewerUrl || data.url || null)
      }
    } catch (err: any) {
      console.error('Error viewing asset:', err)
      alert('Failed to view asset')
    }
  }

  const downloadRaw = async (assetId: string) => {
    const password = prompt('Enter your password for re-authentication:')
    if (!password) return

    const reason = prompt('Reason for raw download (optional):') || 'ADMIN_REVIEW'

    try {
      const response = await fetch(
        `/api/admin/vault/assets/${assetId}/raw?reAuthPassword=${encodeURIComponent(password)}&reasonCode=${encodeURIComponent(reason)}`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to download file')
        return
      }

      const data = await response.json()
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank')
      }
    } catch (err: any) {
      console.error('Error downloading asset:', err)
      alert('Failed to download file')
    }
  }

  const checkDuplicates = async () => {
    if (!vaultData) return
    
    setCheckingDuplicates(true)
    try {
      const assetHashes = vaultData.assets.map(a => a.sha256)
      const response = await fetch('/api/admin/vault/duplicate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assetHashes,
          riftId,
          sellerId: vaultData.rift.seller.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to check duplicates')
        return
      }

      const data = await response.json()
      setDuplicateCheck(data)
    } catch (err: any) {
      console.error('Error checking duplicates:', err)
      alert('Failed to check duplicates')
    } finally {
      setCheckingDuplicates(false)
    }
  }

  const searchHash = async (hash: string) => {
    try {
      const response = await fetch(`/api/admin/vault/hash-search?hash=${encodeURIComponent(hash)}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to search hash')
        return
      }

      const data = await response.json()
      setHashSearchResults(data)
    } catch (err: any) {
      console.error('Error searching hash:', err)
      alert('Failed to search hash')
    }
  }

  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FILE: 'File',
      LICENSE_KEY: 'License Key',
      TRACKING: 'Tracking Number',
      TICKET_PROOF: 'Ticket Proof',
      URL: 'URL',
      TEXT_INSTRUCTIONS: 'Text Instructions',
    }
    return labels[type] || type
  }

  const getScanStatusColor = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'text-green-400'
      case 'FAIL':
        return 'text-red-400'
      case 'PENDING':
        return 'text-yellow-400'
      default:
        return 'text-[#86868b]'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading vault data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <GlassCard className="p-8">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Link href="/admin" className="text-gray-700 hover:text-[#1d1d1f] underline">
                Back to Admin Panel
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  if (!vaultData) {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-light text-[#1d1d1f] tracking-tight">Vault Console</h1>
              <p className="text-[#86868b] font-light mt-2">
                Rift #{vaultData.rift.riftNumber} - {vaultData.rift.itemTitle}
              </p>
            </div>
            <Link 
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin Panel
            </Link>
          </div>
        </div>

        {/* Rift Info */}
        <GlassCard className="mb-6 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 font-light mb-1">Status</p>
              <p className="text-[#1d1d1f] font-light">{vaultData.rift.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-light mb-1">Item Type</p>
              <p className="text-[#1d1d1f] font-light">{vaultData.rift.itemType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-light mb-1">Buyer</p>
              <p className="text-[#1d1d1f] font-light text-sm">{vaultData.rift.buyer.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-light mb-1">Seller</p>
              <p className="text-[#1d1d1f] font-light text-sm">{vaultData.rift.seller.email}</p>
            </div>
          </div>
        </GlassCard>

        {/* Duplicate Check & Hash Search */}
        <GlassCard className="mb-6 p-6">
          <h2 className="text-xl font-light text-[#1d1d1f] mb-4">Proof Verification Tools</h2>
          <div className="flex gap-4 mb-4">
            <PremiumButton
              onClick={checkDuplicates}
              disabled={checkingDuplicates || vaultData.assets.length === 0}
              className="px-4 py-2"
            >
              {checkingDuplicates ? 'Checking...' : 'Check for Duplicate Proofs'}
            </PremiumButton>
          </div>
          
          {duplicateCheck && (
            <div className={`mt-4 p-4 rounded-lg border ${
              duplicateCheck.riskLevel === 'CRITICAL' ? 'border-red-500/50 bg-red-500/10' :
              duplicateCheck.riskLevel === 'HIGH' ? 'border-orange-500/50 bg-orange-500/10' :
              duplicateCheck.riskLevel === 'MEDIUM' ? 'border-yellow-500/50 bg-yellow-500/10' :
              'border-green-500/50 bg-green-500/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`font-medium ${
                  duplicateCheck.isDuplicate ? 'text-red-400' : 'text-green-400'
                }`}>
                  {duplicateCheck.isDuplicate ? '⚠️ Duplicate Proof Detected' : '✅ No Duplicates Found'}
                </h3>
                <span className={`text-xs px-2 py-1 rounded ${
                  duplicateCheck.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                  duplicateCheck.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                  duplicateCheck.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {duplicateCheck.riskLevel} RISK
                </span>
              </div>
              
              {duplicateCheck.isDuplicate && (
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="font-medium">Duplicate Rifts:</p>
                  <ul className="list-disc list-inside space-y-1 text-[#86868b]">
                    {duplicateCheck.duplicateRifts?.map((rift: any) => (
                      <li key={rift.id}>
                        <Link href={`/admin/rifts/${rift.id}`} className="hover:text-[#1d1d1f] underline">
                          Rift #{rift.riftNumber} - {rift.itemTitle} ({rift.status})
                        </Link>
                        {' '}by {rift.seller.email}
                      </li>
                    ))}
                  </ul>
                  
                  {duplicateCheck.recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-current/20">
                      <p className="font-medium mb-1">Recommendations:</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-600">
                        {duplicateCheck.recommendations.map((rec: string, idx: number) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>

        {/* Assets */}
        <GlassCard className="mb-6 p-6">
          <h2 className="text-xl font-light text-[#1d1d1f] mb-6">Vault Assets ({vaultData.assets.length})</h2>

          {vaultData.assets.length === 0 ? (
            <p className="text-[#86868b] font-light">No assets in vault yet.</p>
          ) : (
            <div className="space-y-4">
              {vaultData.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[#1d1d1f] font-light">{getAssetTypeLabel(asset.assetType)}</span>
                        {asset.fileName && (
                          <span className="text-[#86868b] font-light text-sm">{asset.fileName}</span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${getScanStatusColor(asset.scanStatus)} bg-current/10`}>
                          {asset.scanStatus}
                        </span>
                        {asset.qualityScore !== null && asset.qualityScore !== undefined && (
                          <span className="text-gray-400 text-xs">
                            Quality: {asset.qualityScore}/100
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-light font-mono flex items-center gap-2">
                        <span>SHA256: {asset.sha256.substring(0, 16)}...</span>
                        <button
                          onClick={() => {
                            const fullHash = asset.sha256
                            navigator.clipboard.writeText(fullHash)
                            alert('Hash copied to clipboard!')
                            searchHash(fullHash)
                          }}
                          className="text-blue-400 hover:text-blue-300 text-xs underline"
                        >
                          Copy & Search
                        </button>
                      </div>
                      {asset.metadataJson && (
                        <div className="mt-2 text-xs text-gray-400">
                          {asset.metadataJson.pageCount && <span>Pages: {asset.metadataJson.pageCount} </span>}
                          {asset.metadataJson.textLength && <span>Text: {asset.metadataJson.textLength} chars </span>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => viewAsset(asset.id)}
                        className="px-3 py-1.5 text-xs font-light text-gray-700 hover:text-[#1d1d1f] border border-gray-300 hover:border-white/40 rounded transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadRaw(asset.id)}
                        className="px-3 py-1.5 text-xs font-light text-red-400/80 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 rounded transition-colors"
                      >
                        Raw
                      </button>
                    </div>
                  </div>

                  {/* Buyer Access History */}
                  {asset.buyerAccessHistory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-400 font-light mb-2">Buyer Access History:</p>
                      <div className="space-y-1">
                        {asset.buyerAccessHistory.map((event, idx) => (
                          <div key={idx} className="text-xs text-[#86868b] font-light">
                            <span className="text-gray-700">{event.eventType.replace(/_/g, ' ')}</span>
                            {' '}at {new Date(event.timestampUtc).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Viewer Modal */}
        {viewingAsset && viewerUrl && (
          <div className="fixed inset-0 z-[99999] isolate" style={{ isolation: 'isolate' }}>
            {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
            <div className="fixed inset-0 bg-white pointer-events-auto" style={{ zIndex: 99998 }} onClick={() => {
              setViewingAsset(null)
              setViewerUrl(null)
            }}></div>
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ zIndex: 99999 }}>
              <div className="bg-white border border-gray-300 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col pointer-events-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-[#1d1d1f] font-light">Asset Viewer</h3>
                <button
                  onClick={() => {
                    setViewingAsset(null)
                    setViewerUrl(null)
                  }}
                  className="text-[#86868b] hover:text-[#1d1d1f]"
                >
                  ✕
                </button>
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

        {/* Events Log */}
        <GlassCard className="mb-6 p-6">
          <h2 className="text-xl font-light text-[#1d1d1f] mb-6">Recent Events ({vaultData.events.length})</h2>
          {vaultData.events.length === 0 ? (
            <p className="text-[#86868b] font-light">No events logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {vaultData.events.map((event) => (
                <div
                  key={event.id}
                  className="p-3 border border-gray-200 rounded text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[#1d1d1f] font-light">{event.eventType.replace(/_/g, ' ')}</span>
                      {event.asset && (
                        <span className="text-[#86868b] ml-2">
                          - {event.asset.fileName || event.asset.assetType}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {new Date(event.timestampUtc).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[#86868b] text-xs mt-1">
                    Actor: {event.actorRole}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Hash Search Results */}
        {hashSearchResults && (
          <GlassCard className="mb-6 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-light text-[#1d1d1f]">Hash Search Results</h2>
              <button
                onClick={() => setHashSearchResults(null)}
                className="text-[#86868b] hover:text-[#1d1d1f]"
              >
                ✕
              </button>
            </div>
            {hashSearchResults.found ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-700">
                  Found {hashSearchResults.totalAssets} asset(s) across {hashSearchResults.totalRifts} Rift(s)
                </div>
                <div className="space-y-3">
                  {hashSearchResults.rifts.map((rift: any) => (
                    <div key={rift.id} className="p-3 border border-gray-200 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <Link href={`/admin/rifts/${rift.id}`} className="text-[#1d1d1f] hover:underline font-medium">
                          Rift #{rift.riftNumber} - {rift.itemTitle}
                        </Link>
                        <span className={`text-xs px-2 py-1 rounded ${
                          rift.status === 'RELEASED' || rift.status === 'PAID_OUT' ? 'bg-green-500/20 text-green-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {rift.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#86868b] space-y-1">
                        <div>Seller: {rift.seller.email}</div>
                        <div>Buyer: {rift.buyer.email}</div>
                        <div>Submitted: {new Date(rift.proofSubmittedAt).toLocaleString()}</div>
                        <div>Assets: {rift.assets.length}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[#86868b]">No other transactions found with this hash.</p>
            )}
          </GlassCard>
        )}

        {/* Admin Reviews */}
        {vaultData.reviews.length > 0 && (
          <GlassCard className="p-6">
            <h2 className="text-xl font-light text-[#1d1d1f] mb-6">Admin Reviews</h2>
            <div className="space-y-3">
              {vaultData.reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-3 border border-gray-200 rounded"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[#1d1d1f] font-light">{review.status}</span>
                      {review.reviewer && (
                        <span className="text-[#86868b] ml-2 text-sm">
                          by {review.reviewer.name || review.reviewer.email}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {new Date(review.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  )
}

