'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { useToast } from './ui/Toast'
import Timeline from './Timeline'

interface DisputeCaseViewProps {
  disputeId: string
}

export default function DisputeCaseView({ disputeId }: DisputeCaseViewProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [caseData, setCaseData] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadCase()
  }, [disputeId])

  const loadCase = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}`)
      if (!response.ok) {
        throw new Error('Failed to load dispute case')
      }
      const data = await response.json()
      setCaseData(data)
    } catch (error) {
      console.error('Load case error:', error)
      showToast('Failed to load dispute case', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminAction = async (action: string, endpoint: string, note?: string) => {
    setActionLoading(action)
    try {
      const body: any = {}
      if (note) {
        const noteText = prompt(`Enter note for ${action}:`)
        if (!noteText) {
          setActionLoading(null)
          return
        }
        body.note = noteText
      }

      const response = await fetch(`/api/admin/disputes/${disputeId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Action failed', 'error')
        return
      }

      showToast('Action completed successfully', 'success')
      router.refresh()
      loadCase()
    } catch (error) {
      console.error('Admin action error:', error)
      showToast('Action failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <GlassCard>
        <div className="text-white/60 font-light text-center py-12">Loading case...</div>
      </GlassCard>
    )
  }

  if (!caseData) {
    return (
      <GlassCard>
        <div className="text-white/60 font-light text-center py-12">Case not found</div>
      </GlassCard>
    )
  }

  const { dispute, evidence, actions, rift, deliveryProof, chatMessages } = caseData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/disputes"
            className="text-white/60 hover:text-white/80 font-light text-sm mb-2 inline-block"
          >
            ← Back to Queue
          </Link>
          <h1 className="text-4xl font-light text-white tracking-tight">
            Dispute Case #{disputeId.slice(-8)}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-white/60 font-light text-sm">Rift #{rift?.riftNumber || dispute.rift_id.slice(-4)}</div>
          <div className="text-white/80 font-light">{rift?.itemTitle}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Summary */}
          <GlassCard>
            <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
              Dispute Summary
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-white/60 text-sm">Reason:</span>
                <span className="text-white/90 ml-2">{dispute.reason.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-white/60 text-sm">Status:</span>
                <span className="text-white/90 ml-2">{dispute.status.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-white/60 text-sm">Category:</span>
                <span className="text-white/90 ml-2">{dispute.category_snapshot}</span>
              </div>
              {dispute.summary && (
                <div>
                  <span className="text-white/60 text-sm block mb-1">Summary:</span>
                  <p className="text-white/80 font-light">{dispute.summary}</p>
                </div>
              )}
              {dispute.sworn_declaration && (
                <div className="pt-3 border-t border-white/10">
                  <span className="text-green-400/80 text-sm">✓ Sworn declaration confirmed</span>
                </div>
              )}
              {dispute.auto_triage?.decision && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-white/60 text-sm mb-1">Auto-triage:</div>
                  <div className="text-white/80 text-sm">{dispute.auto_triage.decision}</div>
                  <div className="text-white/60 text-xs mt-1">{dispute.auto_triage.rationale}</div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Evidence */}
          {evidence && evidence.length > 0 && (
            <GlassCard>
              <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
                Evidence ({evidence.length})
              </h2>
              <div className="space-y-3">
                {evidence.map((ev: any) => (
                  <div key={ev.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/90 text-sm">{ev.type}</span>
                      <span className="text-white/50 text-xs">
                        {ev.uploader_role} • {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {ev.text_content && (
                      <p className="text-white/70 text-sm font-light mt-2">{ev.text_content}</p>
                    )}
                    {ev.storage_path && (
                      <a
                        href={`/api/admin/disputes/${disputeId}/evidence/${ev.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400/80 hover:text-blue-400 text-sm mt-2 inline-block"
                      >
                        View file →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Delivery Proof */}
          {deliveryProof && (
            <GlassCard>
              <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
                Delivery Proof
              </h2>
              {deliveryProof.delivery && (
                <div className="space-y-2 mb-4">
                  <div className="text-white/60 text-sm">File: {deliveryProof.delivery.file_name}</div>
                  <div className="text-white/60 text-sm">
                    Uploaded: {new Date(deliveryProof.delivery.uploaded_at).toLocaleString()}
                  </div>
                  {deliveryProof.views && deliveryProof.views.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-white/60 text-sm mb-1">View Activity:</div>
                      {deliveryProof.views.map((view: any) => (
                        <div key={view.id} className="text-white/70 text-xs">
                          Viewed {view.seconds_viewed}s
                          {view.downloaded && ' • Downloaded'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {deliveryProof.transfer && (
                <div className="space-y-2">
                  <div className="text-white/60 text-sm">Provider: {deliveryProof.transfer.provider}</div>
                  <div className="text-white/60 text-sm">Status: {deliveryProof.transfer.status}</div>
                  {deliveryProof.transfer.seller_claimed_sent_at && (
                    <div className="text-white/60 text-sm">
                      Seller claimed sent: {new Date(deliveryProof.transfer.seller_claimed_sent_at).toLocaleString()}
                    </div>
                  )}
                  {deliveryProof.transfer.buyer_confirmed_received_at && (
                    <div className="text-green-400/80 text-sm">
                      ✓ Buyer confirmed: {new Date(deliveryProof.transfer.buyer_confirmed_received_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          )}

          {/* Timeline */}
          {rift?.riftEvents && rift.riftEvents.length > 0 && (
            <GlassCard>
              <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
                Event Timeline
              </h2>
              <Timeline
                events={rift.riftEvents.map((e: any) => ({
                  id: e.id,
                  escrowId: e.riftId,
                  type: e.eventType,
                  message: `${e.eventType}: ${JSON.stringify(e.payload)}`,
                  createdById: e.actorId,
                  createdAt: new Date(e.createdAt),
                }))}
                isBuyer={false}
                isSeller={false}
              />
            </GlassCard>
          )}

          {/* Actions History */}
          {actions && actions.length > 0 && (
            <GlassCard>
              <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
                Actions History
              </h2>
              <div className="space-y-2">
                {actions.map((action: any) => (
                  <div key={action.id} className="p-2 rounded bg-white/5 text-white/70 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{action.action_type.replace(/_/g, ' ')}</span>
                      <span className="text-white/50 text-xs">
                        {new Date(action.created_at).toLocaleString()}
                      </span>
                    </div>
                    {action.note && (
                      <p className="text-white/60 text-xs mt-1">{action.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Sidebar - Admin Actions */}
        <div className="space-y-6">
          <GlassCard>
            <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
              Admin Actions
            </h2>
            <div className="space-y-3">
              {['submitted', 'needs_info', 'under_review'].includes(dispute.status) && (
                <>
                  <PremiumButton
                    onClick={() => handleAdminAction('request-info', 'request-info', 'note')}
                    disabled={actionLoading !== null}
                    variant="outline"
                    className="w-full"
                  >
                    {actionLoading === 'request-info' ? 'Processing...' : 'Request More Info'}
                  </PremiumButton>
                  
                  <PremiumButton
                    onClick={() => handleAdminAction('resolve-seller', 'resolve-seller', 'note')}
                    disabled={actionLoading !== null}
                    className="w-full bg-green-500/20 hover:bg-green-500/30 border-green-500/30 text-green-400"
                  >
                    {actionLoading === 'resolve-seller' ? 'Processing...' : 'Resolve in Favor of Seller'}
                  </PremiumButton>
                  
                  <PremiumButton
                    onClick={() => handleAdminAction('resolve-buyer', 'resolve-buyer', 'note')}
                    disabled={actionLoading !== null}
                    variant="outline"
                    className="w-full bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-400"
                  >
                    {actionLoading === 'resolve-buyer' ? 'Processing...' : 'Resolve in Favor of Buyer (Refund)'}
                  </PremiumButton>
                  
                  <PremiumButton
                    onClick={() => handleAdminAction('reject', 'reject', 'note')}
                    disabled={actionLoading !== null}
                    variant="outline"
                    className="w-full bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400"
                  >
                    {actionLoading === 'reject' ? 'Processing...' : 'Reject Dispute'}
                  </PremiumButton>
                </>
              )}
              
              {!['submitted', 'needs_info', 'under_review'].includes(dispute.status) && (
                <div className="space-y-2">
                  <div className="text-white/60 text-sm font-light mb-3">
                    Dispute Status: <span className="text-white/90 font-medium">{dispute.status.replace(/_/g, ' ')}</span>
                  </div>
                  {dispute.status === 'resolved_buyer' && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                      ✓ Resolved in favor of buyer. Refund has been processed.
                    </div>
                  )}
                  {dispute.status === 'resolved_seller' && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                      ✓ Resolved in favor of seller. Funds are eligible for release.
                    </div>
                  )}
                  {dispute.status === 'rejected' && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      ✗ Dispute rejected. Funds are eligible for release.
                    </div>
                  )}
                  <div className="text-white/50 text-xs font-light mt-3">
                    This dispute has been resolved. View actions history below for details.
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Rift Info */}
          <GlassCard>
            <h2 className="text-lg font-light text-white/90 mb-4 tracking-wide uppercase text-xs">
              Rift Details
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-white/60">Buyer:</span>
                <span className="text-white/90 ml-2">{rift?.buyer?.email}</span>
              </div>
              <div>
                <span className="text-white/60">Seller:</span>
                <span className="text-white/90 ml-2">{rift?.seller?.email}</span>
              </div>
              <div>
                <span className="text-white/60">Amount:</span>
                <span className="text-white/90 ml-2">
                  {rift?.currency} {rift?.subtotal?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-white/60">Status:</span>
                <span className="text-white/90 ml-2">{rift?.status}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

