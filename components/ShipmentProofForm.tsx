'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'

interface ShipmentProofFormProps {
  escrowId: string
}

export default function ShipmentProofForm({ escrowId }: ShipmentProofFormProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    trackingNumber: '',
    shippingCarrier: '',
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('trackingNumber', formData.trackingNumber)
      formDataToSend.append('shippingCarrier', formData.shippingCarrier)
      formDataToSend.append('notes', formData.notes)
      if (file) {
        formDataToSend.append('file', file)
      }

      const response = await fetch(`/api/rifts/${escrowId}/upload-shipment-proof`, {
        method: 'POST',
        body: formDataToSend,
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Failed to upload proof', 'error')
        return
      }

      showToast('Shipment proof uploaded successfully', 'success')
      router.refresh()
      setFormData({ trackingNumber: '', shippingCarrier: '', notes: '' })
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
          Tracking Number
        </label>
        <input
          type="text"
          value={formData.trackingNumber}
          onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          placeholder="Enter tracking number"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Shipping Carrier
        </label>
        <input
          type="text"
          value={formData.shippingCarrier}
          onChange={(e) => setFormData({ ...formData, shippingCarrier: e.target.value })}
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          placeholder="e.g., Canada Post, FedEx"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Proof File (Image/PDF)
        </label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept="image/*,.pdf"
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-light file:bg-white/10 file:text-white file:cursor-pointer hover:file:bg-white/20 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
          rows={3}
          placeholder="Additional notes..."
        />
      </div>
      <PremiumButton type="submit" disabled={loading} className="w-full">
        {loading ? 'Uploading...' : 'Upload Proof'}
      </PremiumButton>
    </form>
  )
}

