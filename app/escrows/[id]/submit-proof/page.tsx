'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'

export default function SubmitProofPage() {
  const router = useRouter()
  const params = useParams()
  const escrowId = params.id as string

  const [loading, setLoading] = useState(false)
  const [proofType, setProofType] = useState<'PHYSICAL' | 'SERVICE' | 'DIGITAL'>('PHYSICAL')
  const [proofData, setProofData] = useState<any>({})
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/escrows/${escrowId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proofPayload: proofData,
          uploadedFiles,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to submit proof')
        return
      }

      router.push(`/escrows/${escrowId}`)
    } catch (error) {
      console.error('Submit proof error:', error)
      alert('Failed to submit proof')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <GlassCard className="p-8">
          <h1 className="text-3xl font-light text-white mb-6">Submit Proof of Delivery</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white/80 font-light mb-2">Proof Type</label>
              <select
                value={proofType}
                onChange={(e) => setProofType(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
              >
                <option value="PHYSICAL">Physical Item</option>
                <option value="SERVICE">Service</option>
                <option value="DIGITAL">Digital Product</option>
              </select>
            </div>

            {proofType === 'PHYSICAL' && (
              <>
                <div>
                  <label className="block text-white/80 font-light mb-2">Tracking Number *</label>
                  <input
                    type="text"
                    required
                    value={proofData.trackingNumber || ''}
                    onChange={(e) => setProofData({ ...proofData, trackingNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    placeholder="Enter tracking number"
                  />
                </div>
                <div>
                  <label className="block text-white/80 font-light mb-2">Shipping Carrier *</label>
                  <input
                    type="text"
                    required
                    value={proofData.carrier || ''}
                    onChange={(e) => setProofData({ ...proofData, carrier: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    placeholder="e.g., FedEx, UPS, USPS"
                  />
                </div>
              </>
            )}

            {proofType === 'SERVICE' && (
              <>
                <div>
                  <label className="block text-white/80 font-light mb-2">Completion Confirmation</label>
                  <textarea
                    value={proofData.completionConfirmation || ''}
                    onChange={(e) => setProofData({ ...proofData, completionConfirmation: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    rows={4}
                    placeholder="Describe service completion..."
                  />
                </div>
                <div>
                  <label className="block text-white/80 font-light mb-2">Message Log Reference (optional)</label>
                  <input
                    type="text"
                    value={proofData.messageLogReference || ''}
                    onChange={(e) => setProofData({ ...proofData, messageLogReference: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    placeholder="Reference to conversation/message"
                  />
                </div>
              </>
            )}

            {proofType === 'DIGITAL' && (
              <>
                <div>
                  <label className="block text-white/80 font-light mb-2">File Hash (optional)</label>
                  <input
                    type="text"
                    value={proofData.fileHash || ''}
                    onChange={(e) => setProofData({ ...proofData, fileHash: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    placeholder="SHA-256 hash of delivered file"
                  />
                </div>
                <div>
                  <label className="block text-white/80 font-light mb-2">Access Credential Delivery Log</label>
                  <textarea
                    value={proofData.accessCredentialDelivery || ''}
                    onChange={(e) => setProofData({ ...proofData, accessCredentialDelivery: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    rows={4}
                    placeholder="Describe how access was delivered..."
                  />
                </div>
                <div>
                  <label className="block text-white/80 font-light mb-2">Timestamp</label>
                  <input
                    type="datetime-local"
                    value={proofData.timestamp || ''}
                    onChange={(e) => setProofData({ ...proofData, timestamp: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-white/80 font-light mb-2">Upload Files (optional)</label>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  // In production, upload files to storage and get URLs
                  // For now, just store file names
                  const files = Array.from(e.target.files || [])
                  setUploadedFiles(files.map(f => f.name))
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
            </div>

            <div className="flex gap-3">
              <PremiumButton
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Proof'}
              </PremiumButton>
              <PremiumButton
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </PremiumButton>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  )
}
