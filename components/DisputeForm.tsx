'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PremiumButton from './ui/PremiumButton'

interface DisputeFormProps {
  escrowId: string
}

export default function DisputeForm({ escrowId }: DisputeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      alert('Please provide a reason for the dispute')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/escrows/${escrowId}/raise-dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to raise dispute')
        return
      }

      router.refresh()
      setReason('')
    } catch (error) {
      console.error('Error raising dispute:', error)
      alert('Failed to raise dispute')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">
          Reason for Dispute
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
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

