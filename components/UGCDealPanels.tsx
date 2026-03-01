'use client'

import { useEffect, useMemo, useState } from 'react'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import { useToast } from '@/components/ui/Toast'

type MilestoneStatus =
  | 'DRAFT'
  | 'PENDING_FUNDING'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'IN_REVISION'
  | 'APPROVED'
  | 'DISPUTED'
  | 'RELEASED'
  | 'CANCELED'

type EvidenceType = 'FILE' | 'MESSAGE' | 'DELIVERY' | 'CONTRACT' | 'OTHER'

type Milestone = {
  id: string
  index: number
  title: string
  description?: string | null
  amount: number
  currency: string
  dueAt?: string | null
  acceptanceWindowDays: number
  autoApprove: boolean
  status: MilestoneStatus
  fundedAt?: string | null
  deliveredAt?: string | null
  approvedAt?: string | null
  autoApprovedAt?: string | null
  revisionCount: number
  maxRevisions: number
  MilestoneDelivery?: Array<{ id: string; createdAt: string; note?: string | null }>
  MilestoneRevision?: Array<{ id: string; revisionNumber: number; createdAt: string; note?: string | null }>
  Dispute?: Array<{ id: string; status: string; reasonCode?: string | null }>
}

type DealTimelineEvent = {
  id: string
  type: string
  actorId: string | null
  metadataJson: any
  createdAt: string
}

type TrustPayload = {
  creator: Record<string, any> | null
  brand: Record<string, any> | null
}

export default function UGCDealPanels(props: {
  riftId: string
  isBuyer: boolean
  isSeller: boolean
  currency: string
}) {
  const { showToast } = useToast()
  const [milestones, setMilestones] = useState<Milestone[] | null>(null)
  const [contract, setContract] = useState<any | null>(null)
  const [amendments, setAmendments] = useState<any[]>([])
  const [timeline, setTimeline] = useState<DealTimelineEvent[] | null>(null)
  const [trust, setTrust] = useState<TrustPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingMilestoneId, setUploadingMilestoneId] = useState<string | null>(null)
  const [amendmentBusyId, setAmendmentBusyId] = useState<string | null>(null)

  const isUGCDeal = useMemo(() => Boolean(contract), [contract])

  async function loadAll() {
    try {
      setLoading(true)

      // Contract: determines if this is a UGC deal
      const contractRes = await fetch(`/api/rifts/${props.riftId}/ugc/contract`, { credentials: 'include' })
      if (contractRes.ok) {
        const data = await contractRes.json()
        setContract(data.contract)
        setAmendments(data.amendments || [])
      } else {
        setContract(null)
        setAmendments([])
      }

      const [milestonesRes, timelineRes, trustRes] = await Promise.all([
        fetch(`/api/rifts/${props.riftId}/ugc/milestones`, { credentials: 'include' }),
        fetch(`/api/rifts/${props.riftId}/ugc/timeline`, { credentials: 'include' }),
        fetch(`/api/rifts/${props.riftId}/ugc/trust`, { credentials: 'include' }),
      ])

      if (milestonesRes.ok) setMilestones((await milestonesRes.json()).milestones || [])
      if (timelineRes.ok) setTimeline((await timelineRes.json()).events || [])
      if (trustRes.ok) setTrust(await trustRes.json())
    } catch (e: any) {
      showToast(e?.message || 'Failed to load UGC deal panels', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.riftId])

  const currencySymbol = props.currency === 'USD' || props.currency === 'CAD' ? '$' : props.currency

  function getCountdownText(m: Milestone) {
    if (m.status !== 'DELIVERED' || !m.deliveredAt) return null
    const deliveredAt = new Date(m.deliveredAt)
    const deadline = new Date(deliveredAt.getTime() + m.acceptanceWindowDays * 24 * 60 * 60 * 1000)
    const msLeft = deadline.getTime() - Date.now()
    if (msLeft <= 0) return 'Auto-approval eligible'
    const hours = Math.floor(msLeft / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return `${days}d ${remHours}h left to respond`
  }

  async function handleUploadAndSubmit(m: Milestone, files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingMilestoneId(m.id)
    try {
      const form = new FormData()
      form.append('milestoneId', m.id)
      Array.from(files).forEach((f) => form.append('files', f))

      const uploadRes = await fetch(`/api/rifts/${props.riftId}/ugc/files/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }
      const { assetIds } = await uploadRes.json()

      const submitRes = await fetch(`/api/rifts/${props.riftId}/ugc/milestones/${m.id}/delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileIds: assetIds, note: '' }),
      })
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to submit delivery')
      }

      showToast('Delivery submitted', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Failed to submit delivery', 'error')
    } finally {
      setUploadingMilestoneId(null)
    }
  }

  async function handleApprove(milestoneId: string) {
    try {
      const res = await fetch(`/api/rifts/${props.riftId}/ugc/milestones/${milestoneId}/approve`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Approve failed')
      }
      showToast('Milestone approved and released', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Approve failed', 'error')
    }
  }

  async function handleRevision(milestoneId: string) {
    const note = window.prompt('Optional revision note') || ''
    try {
      const res = await fetch(`/api/rifts/${props.riftId}/ugc/milestones/${milestoneId}/request-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Revision request failed')
      }
      showToast('Revision requested', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Revision request failed', 'error')
    }
  }

  async function handleOpenDispute(m: Milestone) {
    const reasonCode = window.prompt(
      'Reason code (DELIVERABLE_NOT_RECEIVED, DELIVERABLE_NOT_AS_SPECIFIED, LATE_DELIVERY, SCOPE_CHANGE_REQUESTED, IP_RIGHTS_CONFLICT, PAYMENT_ISSUE, OTHER)',
      'DELIVERABLE_NOT_AS_SPECIFIED'
    )
    if (!reasonCode) return
    const description = window.prompt('Short description') || ''
    if (!description.trim()) return

    try {
      const res = await fetch(`/api/rifts/${props.riftId}/ugc/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ milestoneId: m.id, reasonCode, description }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to open dispute')
      }
      showToast('Dispute opened. Auto-approvals and releases are frozen.', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Failed to open dispute', 'error')
    }
  }

  async function handleProposeAmendment() {
    const raw = window.prompt('Paste patch JSON (allowed keys: deliverables, deadlines, revisions, usageRights, whitelisting, acceptanceWindowDays, killFeePercent, currency)')
    if (!raw) return
    let patchJson: any
    try {
      patchJson = JSON.parse(raw)
    } catch {
      showToast('Invalid JSON', 'error')
      return
    }

    try {
      const res = await fetch(`/api/rifts/${props.riftId}/ugc/contract/amendments/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patchJson }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to propose amendment')
      }
      showToast('Change proposed', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Failed to propose amendment', 'error')
    }
  }

  async function handleAmendmentAction(amendmentId: string, action: 'accept' | 'reject') {
    setAmendmentBusyId(amendmentId)
    try {
      const res = await fetch(`/api/rifts/${props.riftId}/ugc/contract/amendments/${amendmentId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      showToast(action === 'accept' ? 'Amendment accepted' : 'Amendment rejected', 'success')
      await loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Failed', 'error')
    } finally {
      setAmendmentBusyId(null)
    }
  }

  if (loading) {
    return null
  }

  if (!isUGCDeal) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Trust panel */}
      <GlassCard className="p-8">
        <h2 className="text-sm font-light text-[#86868b] mb-5 tracking-wider uppercase">Trust Panel</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-gray-600 text-sm mb-3">Creator</p>
            <pre className="text-[#86868b] text-xs whitespace-pre-wrap">{JSON.stringify(trust?.creator ?? {}, null, 2)}</pre>
          </div>
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-gray-600 text-sm mb-3">Brand</p>
            <pre className="text-[#86868b] text-xs whitespace-pre-wrap">{JSON.stringify(trust?.brand ?? {}, null, 2)}</pre>
          </div>
        </div>
      </GlassCard>

      {/* Contract */}
      <GlassCard className="p-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-light text-[#86868b] tracking-wider uppercase">UGC Contract</h2>
          <PremiumButton variant="outline" size="sm" onClick={handleProposeAmendment}>
            Propose change
          </PremiumButton>
        </div>
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
          <pre className="text-gray-600 text-xs whitespace-pre-wrap">{JSON.stringify(contract?.contractJson ?? {}, null, 2)}</pre>
        </div>
        {amendments.length > 0 && (
          <div className="mt-6">
            <p className="text-[#86868b] text-xs uppercase tracking-wider mb-3">Amendments</p>
            <div className="space-y-3">
              {amendments.map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm">{a.status}</span>
                    <span className="text-gray-400 text-xs">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  {a.status === 'PENDING' && (
                    <div className="flex gap-3 mt-3">
                      <PremiumButton
                        variant="primary"
                        size="sm"
                        disabled={amendmentBusyId === a.id}
                        onClick={() => handleAmendmentAction(a.id, 'accept')}
                      >
                        Accept
                      </PremiumButton>
                      <PremiumButton
                        variant="outline"
                        size="sm"
                        disabled={amendmentBusyId === a.id}
                        onClick={() => handleAmendmentAction(a.id, 'reject')}
                      >
                        Reject
                      </PremiumButton>
                    </div>
                  )}
                  <pre className="text-[#86868b] text-xs whitespace-pre-wrap mt-2">{JSON.stringify(a.patchJson ?? {}, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Milestones */}
      <GlassCard className="p-8">
        <h2 className="text-sm font-light text-[#86868b] mb-5 tracking-wider uppercase">Milestones</h2>
        <div className="space-y-4">
          {(milestones || []).map((m) => {
            const countdown = getCountdownText(m)
            const disputeOpen = (m.Dispute || []).length > 0
            return (
              <div key={m.id} className="p-5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-700">{`M${m.index + 1}: ${m.title}`}</span>
                      <span className="text-gray-400 text-xs">{m.status}</span>
                      {disputeOpen && <span className="text-red-300 text-xs">DISPUTE OPEN</span>}
                    </div>
                    {m.description && <p className="text-[#86868b] text-sm mt-1">{m.description}</p>}
                    <p className="text-[#86868b] text-sm mt-2">
                      {currencySymbol}
                      {m.amount.toFixed(2)} • Acceptance window: {m.acceptanceWindowDays}d
                      {m.autoApprove ? ' • Auto-approve enabled' : ''}
                    </p>
                    {countdown && (
                      <p className="text-[#86868b] text-xs mt-2">
                        {countdown} {m.autoApprove ? '(auto-approve if no response)' : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {props.isSeller && (m.status === 'FUNDED' || m.status === 'IN_REVISION') && (
                      <label className="inline-flex items-center">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleUploadAndSubmit(m, e.target.files)}
                          disabled={uploadingMilestoneId === m.id}
                        />
                        <PremiumButton
                          variant="outline"
                          size="sm"
                          disabled={uploadingMilestoneId === m.id}
                        >
                          {uploadingMilestoneId === m.id ? 'Uploading...' : 'Submit delivery (files)'}
                        </PremiumButton>
                      </label>
                    )}

                    {props.isBuyer && m.status === 'DELIVERED' && (
                      <>
                        <PremiumButton variant="primary" size="sm" onClick={() => handleApprove(m.id)}>
                          Approve + Release
                        </PremiumButton>
                        <PremiumButton variant="outline" size="sm" onClick={() => handleRevision(m.id)}>
                          Request revision
                        </PremiumButton>
                      </>
                    )}

                    {(props.isBuyer || props.isSeller) && (
                      <PremiumButton variant="ghost" size="sm" onClick={() => handleOpenDispute(m)}>
                        Open dispute
                      </PremiumButton>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Timeline */}
      <GlassCard className="p-8">
        <h2 className="text-sm font-light text-[#86868b] mb-5 tracking-wider uppercase">Timeline</h2>
        <div className="space-y-3">
          {(timeline || []).map((e) => (
            <div key={e.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 text-sm">{e.type}</span>
                <span className="text-gray-400 text-xs">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              {e.metadataJson && (
                <pre className="text-[#86868b] text-xs whitespace-pre-wrap mt-2">{JSON.stringify(e.metadataJson, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

