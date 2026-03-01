'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'

interface DisputeFormProps {
  escrowId: string
}

export default function DisputeForm({ escrowId }: DisputeFormProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')

  const [disputeType, setDisputeType] = useState<string>('ITEM_NOT_RECEIVED')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      showToast('Please provide a reason for the dispute', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/rifts/${escrowId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason,
          type: disputeType,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Failed to open dispute', 'error')
        return
      }

      showToast('Dispute raised successfully', 'success')
      router.refresh()
      setReason('')
    } catch (error) {
      console.error('Error opening dispute:', error)
      showToast('Failed to open dispute. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-light text-gray-700 mb-2">
          Dispute Type *
        </label>
        <select
          value={disputeType}
          onChange={(e) => setDisputeType(e.target.value)}
          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1d1d1f] focus:outline-none focus:border-gray-300"
        >
          <option value="ITEM_NOT_RECEIVED">Item Not Received</option>
          <option value="ITEM_NOT_AS_DESCRIBED">Item Not As Described</option>
          <option value="ITEM_DAMAGED">Item Damaged</option>
          <option value="WRONG_ITEM">Wrong Item</option>
          <option value="WRONG_ADDRESS">Wrong Address</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">
          Reason for Dispute
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 glass-light border border-gray-200 rounded-xl text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all resize-none"
          rows={4}
          placeholder="Describe the issue..."
          required
        />
      </div>
      <PremiumButton type="submit" variant="outline" disabled={loading} className="w-full">
        {loading ? 'Submitting...' : 'Raise Dispute'}
      </PremiumButton>
    </form>
  )
}

