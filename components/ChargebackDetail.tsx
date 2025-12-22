'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import GlassCard from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface ChargebackDetailProps {
  dispute: any
  rift: any
}

export default function ChargebackDetail({ dispute, rift }: ChargebackDetailProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [generating, setGenerating] = useState(false)

  const handleGenerateEvidence = async () => {
    if (!rift) {
      showToast('Rift not found for this dispute', 'error')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch(`/api/admin/evidence/${rift.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeDisputeId: dispute.stripe_dispute_id }),
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Failed to generate evidence', 'error')
        return
      }

      showToast('Evidence packet generated successfully', 'success')
      router.refresh()
    } catch (error: any) {
      console.error('Error generating evidence:', error)
      showToast(error.message || 'Failed to generate evidence', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs_response':
      case 'warning_needs_response':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'under_review':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'won':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'lost':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="space-y-8">
      {/* Dispute Info */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-light text-white mb-4">Dispute Information</h2>
        <div className="space-y-3 text-white/80 text-sm">
          <p><strong>Stripe Dispute ID:</strong> <code className="font-mono">{dispute.stripe_dispute_id}</code></p>
          <p><strong>Status:</strong> <Badge className={getStatusColor(dispute.status)}>{dispute.status.replace(/_/g, ' ')}</Badge></p>
          <p><strong>Amount:</strong> {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: dispute.currency || 'CAD',
          }).format(dispute.amount_cents / 100)}</p>
          <p><strong>Reason:</strong> {dispute.reason || 'N/A'}</p>
          <p><strong>Evidence Due By:</strong> {dispute.evidence_due_by
            ? format(new Date(dispute.evidence_due_by), 'MMM dd, yyyy HH:mm')
            : 'N/A'}</p>
          <p><strong>Created:</strong> {format(new Date(dispute.created_at), 'MMM dd, yyyy HH:mm')}</p>
          <p><strong>Updated:</strong> {format(new Date(dispute.updated_at), 'MMM dd, yyyy HH:mm')}</p>
          <p><strong>Stripe Charge ID:</strong> <code className="font-mono">{dispute.stripe_charge_id}</code></p>
          {dispute.stripe_payment_intent_id && (
            <p><strong>Payment Intent ID:</strong> <code className="font-mono">{dispute.stripe_payment_intent_id}</code></p>
          )}
        </div>
      </GlassCard>

      {/* Rift Info */}
      {rift ? (
        <GlassCard className="p-6">
          <h2 className="text-xl font-light text-white mb-4">Related Rift</h2>
          <div className="space-y-3 text-white/80 text-sm">
            <p><strong>Rift Number:</strong> #{rift.riftNumber}</p>
            <p><strong>Title:</strong> {rift.itemTitle}</p>
            <p><strong>Category:</strong> {rift.itemType}</p>
            <p><strong>Amount:</strong> {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: rift.currency || 'CAD',
            }).format(rift.subtotal)}</p>
            <p><strong>Status:</strong> {rift.status}</p>
            <div className="flex gap-2 mt-4">
              <Link href={`/admin/rifts/${rift.id}`}>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                  View Rift
                </Button>
              </Link>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-6">
          <p className="text-white/60 text-sm">No rift found for this dispute.</p>
        </GlassCard>
      )}

      {/* Evidence Actions */}
      {rift && (
        <GlassCard className="p-6">
          <h2 className="text-xl font-light text-white mb-4">Evidence Packet</h2>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateEvidence}
                disabled={generating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Evidence Packet'
                )}
              </Button>
              <Link href={`/admin/evidence/${rift.id}?disputeId=${dispute.stripe_dispute_id}`}>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                  View Print View
                </Button>
              </Link>
              <Link href={`/api/admin/evidence/${rift.id}/json?disputeId=${dispute.stripe_dispute_id}`}>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                  Download JSON
                </Button>
              </Link>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  )
}

