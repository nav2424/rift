'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import DeliveryViewer from '@/components/DeliveryViewer'
import VaultAssetsViewer from '@/components/VaultAssetsViewer'
import { useToast } from '@/components/ui/Toast'

interface Delivery {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
}

export default function DeliveryPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { showToast } = useToast()
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [hasVaultAssets, setHasVaultAssets] = useState(false)
  const [loading, setLoading] = useState(true)
  const riftId = params?.id as string

  useEffect(() => {
    if (!session || !riftId) return

    const loadContent = async () => {
      try {
        // First, check for vault assets (proof files)
        const vaultResponse = await fetch(`/api/rifts/${riftId}/vault`)
        
        if (vaultResponse.ok) {
          const vaultData = await vaultResponse.json()
          if (vaultData.assets && vaultData.assets.length > 0) {
            // Vault assets exist - use VaultAssetsViewer instead
            setHasVaultAssets(true)
            setLoading(false)
            return
          }
        }

        // If no vault assets, try to get digital delivery
        const response = await fetch(`/api/rifts/${riftId}/delivery/viewer`, {
          method: 'POST',
        })

        if (!response.ok) {
          // No digital delivery either - redirect back to rift page
          router.push(`/rifts/${riftId}`)
          return
        }

        const data = await response.json()
        setDelivery(data.delivery)
      } catch (error: any) {
        console.error('Load content error:', error)
        router.push(`/rifts/${riftId}`)
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [session, riftId, router, showToast])

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  // Show vault assets if they exist (for proof files)
  if (hasVaultAssets) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="mb-6">
            <button
              onClick={() => router.push(`/rifts/${riftId}`)}
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              ← Back to Rift
            </button>
          </div>
          <VaultAssetsViewer riftId={riftId} isBuyer={true} />
        </div>
      </div>
    )
  }

  // Show digital delivery viewer if it exists
  if (delivery) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
            <DeliveryViewer
              riftId={riftId}
              delivery={delivery}
              onClose={() => router.push(`/rifts/${riftId}`)}
            />
          </div>
        </div>
      </div>
    )
  }

  // Nothing to show - should have redirected, but just in case
  return null
}

