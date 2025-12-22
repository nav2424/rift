'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import { useToast } from '@/components/ui/Toast'

interface RiftTransaction {
  id: string
  itemTitle: string
  itemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES'
  status: string
  sellerId: string
  buyerId: string
  shippingAddress?: string | null
}

export default function SubmitProofPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const { showToast } = useToast()
  const [rift, setRift] = useState<RiftTransaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    notes: '',
    trackingNumber: '',
    shippingCarrier: '',
  })
  const [files, setFiles] = useState<File[]>([])

  const riftId = params?.id as string

  useEffect(() => {
    if (sessionStatus === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    loadRift()
  }, [session, sessionStatus, riftId])

  const loadRift = async () => {
    try {
      const response = await fetch(`/api/rifts/${riftId}`)
      if (!response.ok) {
        throw new Error('Failed to load rift')
      }
      const data = await response.json()
      setRift(data)
      
      // Verify user is the seller
      if (data.sellerId !== session?.user?.id) {
        showToast('Only the seller can submit proof', 'error')
        router.push(`/rifts/${riftId}`)
        return
      }
    } catch (error) {
      console.error('Error loading rift:', error)
      showToast('Failed to load rift', 'error')
      router.push(`/rifts/${riftId}`)
    } finally {
      setLoading(false)
    }
  }

  const getProofTypeText = () => {
    if (!rift) return 'proof'
    switch (rift.itemType) {
      case 'PHYSICAL':
        return 'shipment proof with tracking number'
      case 'DIGITAL':
        return 'proof of digital product transfer (screenshot, license key, etc.)'
      case 'TICKETS':
        return 'proof of ticket transfer (screenshot of transfer confirmation, email, etc.)'
      case 'SERVICES':
        return 'proof of service completion (photos, completion certificate, etc.)'
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rift?.itemType === 'PHYSICAL' && !formData.trackingNumber) {
      showToast('Tracking number is required for physical items', 'error')
      return
    }

    if (files.length === 0) {
      showToast('Please upload at least one proof file', 'error')
      return
    }

    setSubmitting(true)

    try {
      // For physical items, use the upload-shipment-proof endpoint
      if (rift?.itemType === 'PHYSICAL') {
        const formDataToSend = new FormData()
        formDataToSend.append('trackingNumber', formData.trackingNumber)
        if (formData.shippingCarrier) {
          formDataToSend.append('shippingCarrier', formData.shippingCarrier)
        }
        if (formData.notes) {
          formDataToSend.append('notes', formData.notes)
        }
        if (files[0]) {
          formDataToSend.append('file', files[0])
        }

        const response = await fetch(`/api/rifts/${riftId}/upload-shipment-proof`, {
          method: 'POST',
          body: formDataToSend,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to upload proof')
        }

        showToast('Proof submitted successfully', 'success')
        router.push(`/rifts/${riftId}`)
        return
      }

      // For non-physical items, upload files via FormData
      const formDataToSend = new FormData()
      
      if (formData.notes) {
        formDataToSend.append('notes', formData.notes)
      }
      
      // Append all files
      files.forEach((file) => {
        formDataToSend.append('files', file)
      })

      // Submit proof with FormData
      const response = await fetch(`/api/rifts/${riftId}/proof`, {
        method: 'POST',
        body: formDataToSend,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit proof')
      }

      showToast(data.message || 'Proof submitted successfully', 'success')
      router.push(`/rifts/${riftId}`)
    } catch (error: any) {
      console.error('Error submitting proof:', error)
      showToast(error.message || 'Failed to submit proof. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  if (!rift) {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <div className="mb-8">
          <Link
            href={`/rifts/${riftId}`}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-all mb-6 font-light group"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm">Back to Rift</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-light text-white mb-2 tracking-tight">
            Submit Proof of Delivery
          </h1>
          <p className="text-white/60 font-light">
            {rift.itemTitle}
          </p>
        </div>

        <GlassCard className="p-8 lg:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Proof Files <span className="text-red-400">*</span>
              </label>
              <p className="text-white/50 text-xs font-light mb-3">
                Upload {getProofTypeText()}
              </p>
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                multiple
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-light file:bg-white/10 file:text-white file:cursor-pointer hover:file:bg-white/20 transition-all"
              />
              {files.length > 0 && (
                <p className="text-white/60 text-xs mt-2">
                  {files.length} file(s) selected
                </p>
              )}
            </div>

            {rift.itemType === 'PHYSICAL' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Tracking Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    placeholder="Enter tracking number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Shipping Carrier (Optional)
                  </label>
                  <select
                    value={formData.shippingCarrier}
                    onChange={(e) => setFormData({ ...formData, shippingCarrier: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  >
                    <option value="">Select carrier</option>
                    <option value="UPS">UPS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="USPS">USPS</option>
                    <option value="DHL">DHL</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
                rows={4}
                placeholder="Additional notes or instructions..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <PremiumButton
                type="button"
                variant="outline"
                onClick={() => router.push(`/rifts/${riftId}`)}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </PremiumButton>
              <PremiumButton
                type="submit"
                disabled={submitting || files.length === 0 || (rift.itemType === 'PHYSICAL' && !formData.trackingNumber)}
                className="flex-1"
              >
                {submitting ? 'Submitting...' : 'Submit Proof'}
              </PremiumButton>
            </div>

            <p className="text-white/40 text-xs font-light pt-4 border-t border-white/10">
              Your proof will be reviewed by our team. Once approved, the buyer will have 24-48 hours to review before funds are automatically released.
            </p>
          </form>
        </GlassCard>
      </div>
    </div>
  )
}
