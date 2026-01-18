'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import ProofQualityIndicator from '@/components/ProofQualityIndicator'
import { useToast } from '@/components/ui/Toast'

interface RiftTransaction {
  id: string
  itemTitle: string
  itemType: 'DIGITAL_GOODS' | 'SERVICES'
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
    deliverySummary: '',
    scopeCompletion: '',
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
        let errorMessage = 'Failed to load rift'
        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorMessage
          } else {
            const text = await response.text()
            errorMessage = text || response.statusText || errorMessage
          }
        } catch (parseError) {
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      const data = await response.json()
      setRift(data)
      
      // Verify user is the seller
      if (data.sellerId !== session?.user?.id) {
        showToast('Only the seller can submit proof', 'error')
        router.push(`/rifts/${riftId}`)
        return
      }
    } catch (error: any) {
      console.error('Error loading rift:', error)
      const errorMessage = error?.message || 'Failed to load rift'
      showToast(errorMessage, 'error')
      router.push(`/rifts/${riftId}`)
    } finally {
      setLoading(false)
    }
  }

  const getProofTypeText = () => {
    if (!rift) return 'proof'
    switch (rift.itemType) {
      case 'DIGITAL_GOODS':
        return 'proof of content delivery (files or delivery links)'
      case 'SERVICES':
        return 'proof of service completion (summary and deliverables)'
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rift?.itemType === 'DIGITAL_GOODS') {
      if (files.length === 0) {
        showToast('Please upload at least one proof file', 'error')
        return
      }
    }

    if (rift?.itemType === 'SERVICES') {
      if (!formData.deliverySummary || !formData.scopeCompletion) {
        showToast('Please add a delivery summary and scope completion', 'error')
        return
      }
    }

    setSubmitting(true)

    try {
      // For non-physical items, upload files via FormData
      const formDataToSend = new FormData()
      
      if (formData.notes) {
        formDataToSend.append('notes', formData.notes)
      }
      
      // Append service metadata if SERVICES item type
      if (rift?.itemType === 'SERVICES') {
        if (formData.deliverySummary) {
          formDataToSend.append('deliverySummary', formData.deliverySummary)
        }
        if (formData.scopeCompletion) {
          formDataToSend.append('scopeCompletion', formData.scopeCompletion)
        }
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
        // Show detailed validation errors if available
        const errorMessage = data.details && Array.isArray(data.details) 
          ? `${data.error}\n\n${data.details.join('\n')}`
          : data.error || 'Failed to submit proof'
        throw new Error(errorMessage)
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
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-light text-white mb-2 tracking-tight">
                {rift.itemType === 'DIGITAL_GOODS' ? 'Add Content Proof to Vault' : 'Add Completion Proof to Vault'}
              </h1>
              <p className="text-white/60 font-light">
                {rift.itemTitle}
              </p>
              <p className="text-white/40 text-sm font-light mt-2">
                {getProofTypeText()}
              </p>
            </div>
            <Link
              href={`/rifts/${riftId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Rift
            </Link>
          </div>
        </div>

        <GlassCard className="p-8 lg:p-10">
          {/* Proof Quality Indicator - Will show after files are selected */}
          {files.length > 0 && (
            <div className="mb-6">
              <ProofQualityIndicator
                riftId={riftId}
                assetIds={[]} // Will be populated after upload
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload - Required for all item types */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Proof Files {rift.itemType === 'DIGITAL_GOODS' && <span className="text-red-400">*</span>}
              </label>
              <p className="text-white/50 text-xs font-light mb-3">
                {rift.itemType === 'DIGITAL_GOODS' && 'Upload files, PDFs, or screenshots of the final deliverables'}
                {rift.itemType === 'SERVICES' && 'Upload photos, completion certificate, or service proof'}
              </p>
              <input
                type="file"
                onChange={handleFileChange}
                accept={rift.itemType === 'DIGITAL_GOODS' ? "image/*,.pdf,.zip" : "image/*,.pdf"}
                multiple
                required={rift.itemType === 'DIGITAL_GOODS'}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-light file:bg-white/10 file:text-white file:cursor-pointer hover:file:bg-white/20 transition-all"
              />
              {files.length > 0 && (
                <p className="text-white/60 text-xs mt-2">
                  {files.length} file(s) selected
                </p>
              )}
            </div>

            {/* Service Fields - For SERVICES Item Type */}
            {rift.itemType === 'SERVICES' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Delivery Summary <span className="text-red-400">*</span>
                  </label>
                  <p className="text-white/50 text-xs font-light mb-3">
                    Describe what was delivered or completed
                  </p>
                  <textarea
                    value={formData.deliverySummary}
                    onChange={(e) => setFormData({ ...formData, deliverySummary: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
                    rows={3}
                    placeholder="Describe what was delivered..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Scope Completion <span className="text-red-400">*</span>
                  </label>
                  <p className="text-white/50 text-xs font-light mb-3">
                    Confirm that the agreed scope of work has been completed
                  </p>
                  <textarea
                    value={formData.scopeCompletion}
                    onChange={(e) => setFormData({ ...formData, scopeCompletion: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
                    rows={3}
                    placeholder="Confirm scope completion..."
                  />
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
                disabled={
                  submitting || 
                  (rift.itemType === 'DIGITAL_GOODS' && files.length === 0) ||
                  (rift.itemType === 'SERVICES' && (!formData.deliverySummary || !formData.scopeCompletion))
                }
                className="flex-1"
              >
                {submitting ? 'Adding to Vault...' : 'Add to Vault'}
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
