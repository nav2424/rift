'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { useToast } from './ui/Toast'
import Timeline from './Timeline'
import EvidencePDFViewer from './EvidencePDFViewer'

interface DisputeCaseViewProps {
  disputeId: string
}

export default function DisputeCaseView({ disputeId }: DisputeCaseViewProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [caseData, setCaseData] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewingPDF, setViewingPDF] = useState<{ evidenceId: string; fileName?: string } | null>(null)

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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || errorData.message || `Action failed (${response.status})`
        console.error('Admin action error:', {
          action,
          endpoint,
          status: response.status,
          error: errorMessage,
          details: errorData,
        })
        showToast(errorMessage, 'error')
        setActionLoading(null)
        return
      }

      const result = await response.json()
      console.log('Admin action success:', { action, endpoint, result })
      
      showToast('Action completed successfully', 'success')
      
      // Reload case data and refresh page
      await loadCase()
      router.refresh()
      
      // Small delay to ensure UI updates
      setTimeout(() => {
        setActionLoading(null)
      }, 500)
    } catch (error: any) {
      console.error('Admin action error:', error)
      showToast(error?.message || 'Action failed. Please try again.', 'error')
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

  const { dispute, evidence, actions, rift, deliveryProof, chatMessages, aiAnalysis, evidenceSummary } = caseData

  return (
    <div className="space-y-6">
      {/* AI Analysis Section - Prominent Display */}
      {aiAnalysis && (
        <GlassCard className="border-blue-500/30 bg-blue-500/5">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h2 className="text-xl font-light text-white">AI Analysis</h2>
            </div>
            
            <div className="space-y-4">
              {/* Suggested Outcome */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60 font-light">Suggested Outcome</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-light ${
                    aiAnalysis.suggestedOutcome === 'buyer' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : aiAnalysis.suggestedOutcome === 'seller'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {aiAnalysis.suggestedOutcome.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-white/80 font-light text-sm">{aiAnalysis.reasoning}</p>
                <div className="mt-2">
                  <span className="text-xs text-white/50">Confidence: </span>
                  <span className="text-xs text-white/80 font-medium">{aiAnalysis.confidenceScore}%</span>
                </div>
              </div>

              {/* Key Facts */}
              {aiAnalysis.keyFacts && aiAnalysis.keyFacts.length > 0 && (
                <div>
                  <h3 className="text-sm text-white/60 font-light mb-2">Key Facts</h3>
                  <ul className="space-y-1">
                    {aiAnalysis.keyFacts.map((fact: string, idx: number) => (
                      <li key={idx} className="text-white/80 font-light text-sm flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Flags */}
              {aiAnalysis.flags && (
                <div className="flex flex-wrap gap-2">
                  {aiAnalysis.flags.frivolous && (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-light">
                      ⚠️ Frivolous
                    </span>
                  )}
                  {aiAnalysis.flags.legitimate && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-light">
                      ✓ Legitimate
                    </span>
                  )}
                  {aiAnalysis.flags.requiresUrgentReview && (
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-light">
                      🚨 Urgent Review
                    </span>
                  )}
                </div>
              )}

              {/* Sentiment */}
              {aiAnalysis.sentiment && (
                <div className="text-xs text-white/60">
                  <span>Credibility: {aiAnalysis.sentiment.credibility}/100</span>
                  <span className="mx-2">•</span>
                  <span>Sentiment: {aiAnalysis.sentiment.overall}</span>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Evidence Summary */}
      {evidenceSummary && (
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-light text-white mb-4">Evidence Summary</h2>
            <div className="prose prose-invert max-w-none">
              <div className="text-white/80 font-light whitespace-pre-wrap text-sm">
                {evidenceSummary.summary}
              </div>
              
              {evidenceSummary.contradictions && evidenceSummary.contradictions.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <h3 className="text-sm text-yellow-400 font-light mb-2">Contradictions Detected</h3>
                  <ul className="space-y-1">
                    {evidenceSummary.contradictions.map((c: any, idx: number) => (
                      <li key={idx} className="text-white/80 text-sm font-light">
                        • {c.contradiction} <span className="text-white/50">({c.severity})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-light text-white tracking-tight mb-2">
              Dispute Case #{disputeId.slice(-8)}
            </h1>
            <div className="text-white/60 font-light text-sm">
              Rift #{rift?.riftNumber || dispute.rift_id.slice(-4)} - {rift?.itemTitle}
            </div>
          </div>
          <Link
            href="/admin/disputes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-light transition-all duration-200 group flex-shrink-0 mt-1"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Queue
          </Link>
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
                      <div className="flex gap-2 mt-2">
                        {ev.type === 'pdf' ? (
                          <button
                            onClick={() => setViewingPDF({ evidenceId: ev.id, fileName: ev.meta?.fileName || 'Evidence.pdf' })}
                            className="text-blue-400/80 hover:text-blue-400 text-sm font-light transition-colors"
                          >
                            View PDF →
                          </button>
                        ) : (
                          <a
                            href={`/api/admin/disputes/${disputeId}/evidence/${ev.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400/80 hover:text-blue-400 text-sm font-light transition-colors"
                          >
                            View file →
                          </a>
                        )}
                        <a
                          href={`/api/admin/disputes/${disputeId}/evidence/${ev.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="text-white/50 hover:text-white/70 text-sm font-light transition-colors"
                        >
                          Download
                        </a>
                      </div>
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
                <div className="ml-2 flex items-center gap-2">
                  <span className="text-white/90">{rift?.buyer?.email}</span>
                  {rift?.buyer?.emailVerified && rift?.buyer?.phoneVerified && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Email & Phone Verified" />
                  )}
                  {rift?.buyer && (!rift.buyer.emailVerified || !rift.buyer.phoneVerified) && (
                    <span className="text-xs text-yellow-400/80" title="Verification incomplete">
                      ⚠
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-white/60">Seller:</span>
                <div className="ml-2 flex items-center gap-2">
                  <span className="text-white/90">{rift?.seller?.email}</span>
                  {rift?.seller?.emailVerified && rift?.seller?.phoneVerified && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Email & Phone Verified" />
                  )}
                  {rift?.seller && (!rift.seller.emailVerified || !rift.seller.phoneVerified) && (
                    <span className="text-xs text-yellow-400/80" title="Verification incomplete">
                      ⚠
                    </span>
                  )}
                </div>
              </div>
              {caseData.dispute?.openedByUser && (
                <div>
                  <span className="text-white/60">Opened By:</span>
                  <div className="ml-2 flex items-center gap-2">
                    <span className="text-white/90">{caseData.dispute.openedByUser.email}</span>
                    {caseData.dispute.openedByUser.emailVerified && caseData.dispute.openedByUser.phoneVerified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Email & Phone Verified" />
                    )}
                    {caseData.dispute.openedByUser && (!caseData.dispute.openedByUser.emailVerified || !caseData.dispute.openedByUser.phoneVerified) && (
                      <span className="text-xs text-yellow-400/80" title="Verification incomplete">
                        ⚠
                      </span>
                    )}
                  </div>
                </div>
              )}
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

      {/* PDF Viewer Modal */}
      {viewingPDF && (
        <EvidencePDFViewer
          disputeId={disputeId}
          evidenceId={viewingPDF.evidenceId}
          fileName={viewingPDF.fileName}
          onClose={() => setViewingPDF(null)}
        />
      )}
    </div>
  )
}

