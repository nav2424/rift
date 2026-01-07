'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'

interface DeliveryProofFormProps {
  escrowId: string
  itemType: 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES'
}

export default function DeliveryProofForm({ escrowId, itemType }: DeliveryProofFormProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const getProofTypeText = () => {
    switch (itemType) {
      case 'DIGITAL_GOODS':
        return 'proof of digital product transfer (screenshot, license key, etc.)'
      case 'OWNERSHIP_TRANSFER':
        return 'proof of ticket transfer (screenshot of transfer confirmation, email, etc.)'
      case 'SERVICES':
        return 'proof of service completion (photos, completion certificate, etc.)'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      alert(`Please upload ${getProofTypeText()}`)
      return
    }

    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', file)
      if (notes) {
        formDataToSend.append('notes', notes)
      }

      const response = await fetch(`/api/rifts/${escrowId}/mark-delivered`, {
        method: 'POST',
        body: formDataToSend,
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Failed to upload proof', 'error')
        return
      }

      showToast('Proof uploaded successfully. Buyer has 24 hours to review.', 'success')
      router.refresh()
      setNotes('')
      setFile(null)
    } catch (error) {
      console.error('Error uploading proof:', error)
      showToast('Failed to upload proof. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Proof of Delivery <span className="text-red-400">*</span>
        </label>
        <p className="text-white/50 text-xs font-light mb-2">
          Upload {getProofTypeText()}
        </p>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept="image/*,.pdf"
          required
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-light file:bg-white/10 file:text-white file:cursor-pointer hover:file:bg-white/20 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
          rows={3}
          placeholder="Additional notes or instructions..."
        />
      </div>
      <PremiumButton type="submit" disabled={loading || !file} className="w-full">
        {loading ? 'Uploading...' : 'Mark as Delivered & Upload Proof'}
      </PremiumButton>
      <p className="text-white/40 text-xs font-light">
        Once proof is uploaded, funds will auto-release after 24 hours unless the buyer raises a dispute.
      </p>
    </form>
  )
}

