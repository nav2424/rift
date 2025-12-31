'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import ProofQualityIndicator from '@/components/ProofQualityIndicator'
import DatePicker from '@/components/ui/DatePicker'
import { useToast } from '@/components/ui/Toast'

interface RiftTransaction {
  id: string
  itemTitle: string
  itemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES' | 'LICENSE_KEYS'
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
    licenseKey: '',
    url: '',
    textContent: '',
    softwareName: '',
    licenseType: '',
    eventName: '',
    eventDate: '',
    platform: '',
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
      case 'PHYSICAL':
        return 'shipment proof with tracking number'
      case 'DIGITAL':
        return 'proof of digital product transfer (screenshot, license key, etc.)'
      case 'TICKETS':
        return 'proof of ticket transfer (screenshot of transfer confirmation, email, etc.)'
      case 'SERVICES':
        return 'proof of service completion (photos, completion certificate, etc.)'
      case 'LICENSE_KEYS':
        return 'license key or account access (enter key, upload proof, or provide download link)'
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

    // Validation: For digital items, require either files or license key
    if (rift?.itemType === 'DIGITAL') {
      if (files.length === 0 && !formData.licenseKey) {
        showToast('Please upload at least one proof file or provide a license key', 'error')
        return
      }
    } else {
      // For other item types, files are required
      if (files.length === 0) {
        showToast('Please upload at least one proof file', 'error')
        return
      }
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
      
      // Append license key if provided (for digital items or license keys)
      if ((rift?.itemType === 'DIGITAL' || rift?.itemType === 'LICENSE_KEYS') && formData.licenseKey) {
        formDataToSend.append('licenseKey', formData.licenseKey)
      }

      // Append license key metadata if LICENSE_KEYS item type
      if (rift?.itemType === 'LICENSE_KEYS') {
        if (formData.softwareName) {
          formDataToSend.append('softwareName', formData.softwareName)
        }
        if (formData.licenseType) {
          formDataToSend.append('licenseType', formData.licenseType)
        }
        if (formData.url) {
          formDataToSend.append('url', formData.url)
        }
      }

      // Append ticket metadata if TICKETS item type
      if (rift?.itemType === 'TICKETS') {
        if (formData.eventName) {
          formDataToSend.append('eventName', formData.eventName)
        }
        if (formData.eventDate) {
          formDataToSend.append('eventDate', formData.eventDate)
        }
        if (formData.platform) {
          formDataToSend.append('platform', formData.platform)
        }
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
                {rift.itemType === 'DIGITAL' ? 'Add File/PDF to Vault' :
                 rift.itemType === 'TICKETS' ? 'Add Ticket Proof to Vault' :
                 rift.itemType === 'SERVICES' ? 'Add Completion Proof to Vault' :
                 rift.itemType === 'PHYSICAL' ? 'Add Shipment Proof to Vault' :
                 'Add Proof to Vault'}
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
                Proof Files {rift.itemType !== 'DIGITAL' && <span className="text-red-400">*</span>}
              </label>
              <p className="text-white/50 text-xs font-light mb-3">
                {rift.itemType === 'DIGITAL' && 'Upload files, PDFs, or screenshots (optional if providing license key)'}
                {rift.itemType === 'TICKETS' && 'Upload screenshot of transfer confirmation, email, or ticket proof'}
                {rift.itemType === 'SERVICES' && 'Upload photos, completion certificate, or service proof'}
                {rift.itemType === 'PHYSICAL' && 'Upload shipment proof or receipt'}
              </p>
              <input
                type="file"
                onChange={handleFileChange}
                accept={rift.itemType === 'DIGITAL' ? "image/*,.pdf,.zip" : "image/*,.pdf"}
                multiple
                required={rift.itemType !== 'DIGITAL'}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-light file:bg-white/10 file:text-white file:cursor-pointer hover:file:bg-white/20 transition-all"
              />
              {files.length > 0 && (
                <p className="text-white/60 text-xs mt-2">
                  {files.length} file(s) selected
                </p>
              )}
            </div>

            {/* License Key - For Digital Items */}
            {rift.itemType === 'DIGITAL' && (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  License Key (Optional)
                </label>
                <p className="text-white/50 text-xs font-light mb-3">
                  Enter the license key or activation code for the digital product
                </p>
                <input
                  type="text"
                  value={formData.licenseKey}
                  onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-mono"
                  placeholder="Enter license key or activation code"
                />
                <p className="text-white/40 text-xs mt-2">
                  {files.length === 0 && !formData.licenseKey && 'Either files or license key is required'}
                </p>
              </div>
            )}

            {/* Ticket Fields - For TICKETS Item Type */}
            {rift.itemType === 'TICKETS' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Event Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.eventName}
                    onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    placeholder="e.g., Taylor Swift Concert"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Event Date <span className="text-red-400">*</span>
                  </label>
                  <DatePicker
                    value={formData.eventDate}
                    onChange={(value) => setFormData({ ...formData, eventDate: value })}
                    minDate={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Platform <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    placeholder="e.g., Ticketmaster, StubHub, etc."
                  />
                </div>
              </>
            )}

            {/* License Key Fields - For LICENSE_KEYS Item Type */}
            {rift.itemType === 'LICENSE_KEYS' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Software Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.softwareName}
                    onChange={(e) => setFormData({ ...formData, softwareName: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    placeholder="e.g., Adobe Photoshop, Microsoft Office"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    License Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.licenseType}
                    onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  >
                    <option value="">Select license type</option>
                    <option value="SINGLE_USE">Single Use</option>
                    <option value="MULTI_USE">Multi-Use</option>
                    <option value="LIFETIME">Lifetime</option>
                    <option value="SUBSCRIPTION">Subscription</option>
                    <option value="ACCOUNT_ACCESS">Account Access</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    License Key
                  </label>
                  <p className="text-white/50 text-xs font-light mb-3">
                    Enter the license key or activation code. Alternatively, upload a file with the key or provide a download link.
                  </p>
                  <input
                    type="text"
                    value={formData.licenseKey}
                    onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-mono"
                    placeholder="Enter license key or activation code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Download Link (Optional)
                  </label>
                  <p className="text-white/50 text-xs font-light mb-3">
                    If the license key is provided via download link instead of direct entry
                  </p>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    placeholder="https://..."
                  />
                </div>

                <p className="text-white/40 text-xs mt-2">
                  {files.length === 0 && !formData.licenseKey && !formData.url && 'Either license key, file, or download link is required'}
                </p>
              </>
            )}

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
                disabled={
                  submitting || 
                  (rift.itemType === 'PHYSICAL' && !formData.trackingNumber) ||
                  (rift.itemType === 'DIGITAL' && files.length === 0 && !formData.licenseKey) ||
                  (rift.itemType === 'LICENSE_KEYS' && (!formData.softwareName || !formData.licenseType || (files.length === 0 && !formData.licenseKey && !formData.url))) ||
                  (rift.itemType === 'TICKETS' && (!formData.eventName || !formData.eventDate || !formData.platform || files.length === 0)) ||
                  (rift.itemType === 'SERVICES' && (!formData.deliverySummary || !formData.scopeCompletion)) ||
                  (rift.itemType !== 'DIGITAL' && rift.itemType !== 'PHYSICAL' && rift.itemType !== 'LICENSE_KEYS' && rift.itemType !== 'TICKETS' && rift.itemType !== 'SERVICES' && files.length === 0)
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
