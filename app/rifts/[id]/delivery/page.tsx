'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import DeliveryViewer from '@/components/DeliveryViewer'
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
  const [loading, setLoading] = useState(true)
  const riftId = params?.id as string

  useEffect(() => {
    if (!session || !riftId) return

    const loadDelivery = async () => {
      try {
        // Fetch delivery info from API
        // For now, we'll get it from the viewer endpoint
        const response = await fetch(`/api/rifts/${riftId}/delivery/viewer`, {
          method: 'POST',
        })

        if (!response.ok) {
          const error = await response.json()
          showToast(error.error || 'Delivery not found', 'error')
          router.push(`/rifts/${riftId}`)
          return
        }

        const data = await response.json()
        setDelivery(data.delivery)
      } catch (error: any) {
        console.error('Load delivery error:', error)
        showToast('Failed to load delivery', 'error')
        router.push(`/rifts/${riftId}`)
      } finally {
        setLoading(false)
      }
    }

    loadDelivery()
  }, [session, riftId, router, showToast])

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading delivery...</div>
      </div>
    )
  }

  if (!delivery) {
    return null
  }

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

