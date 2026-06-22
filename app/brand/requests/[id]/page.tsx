'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import FocusLayout from '@/components/layouts/FocusLayout'
import StatusBadge from '@/components/requests/StatusBadge'
import { FORMAT_LABELS, LENGTH_LABELS, formatUsd } from '@/lib/video-requests'

const BRAND_NAV = [
  { href: '/brand/requests', label: 'Requests' },
  { href: '/brand/new', label: 'New request' },
]

const STAGES = ['PENDING_REVIEW', 'COUNTER_OFFERED', 'AGREED', 'IN_PRODUCTION', 'DELIVERED', 'CLOSED'] as const

export default function BrandRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [req, setReq] = useState<{
    id: string
    requestNumber: number
    script: string
    styleNotes: string | null
    format: string
    length: string
    videoCount: number
    status: string
    offeredPricePerVideo: number
    counterPricePerVideo: number | null
    agreedPricePerVideo: number | null
    counterMessage: string | null
    deadline: string
    milestones: Array<{ id: string; label: string; completedAt: string | null }>
    deliverables: Array<{ id: string; fileName: string; fileUrl: string }>
  } | null>(null)

  const load = () => {
    fetch(`/api/requests/${id}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 404) router.push('/brand/requests')
        return r.json()
      })
      .then((d) => setReq(d.request))
  }

  useEffect(() => { load() }, [id, router])

  const respond = async (action: 'accept' | 'decline') => {
    await fetch(`/api/requests/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action }),
    })
    load()
  }

  const markComplete = async () => {
    await fetch(`/api/requests/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'closed' }),
    })
    load()
  }

  if (!req) {
    return (
      <FocusLayout nav={BRAND_NAV} title="Request">
        <p className="text-sm text-[#71717A]">Loading…</p>
      </FocusLayout>
    )
  }

  const stageIndex = STAGES.findIndex((s) => s === req.status || (s === 'COUNTER_OFFERED' && ['COUNTER_OFFERED', 'NEGOTIATING'].includes(req.status)))

  return (
    <FocusLayout nav={BRAND_NAV} title={`Request #${req.requestNumber}`}>
      <Link href="/brand/requests" className="text-xs text-[#71717A] hover:text-[#18181B] mb-6 inline-block">← Back</Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <StatusBadge status={req.status} />
        </div>
        <div className="flex gap-1">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${i <= stageIndex ? 'bg-[#18181B]' : 'bg-[#E4E4E7]'}`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl space-y-8">
        <section className="bg-white border border-[#E4E4E7] rounded p-6">
          <h2 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Requirements</h2>
          <p className="text-sm whitespace-pre-wrap mb-4">{req.script}</p>
          {req.styleNotes && <p className="text-sm text-[#71717A] mb-4">{req.styleNotes}</p>}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-[#71717A]">Format</dt><dd>{FORMAT_LABELS[req.format]}</dd>
            <dt className="text-[#71717A]">Length</dt><dd>{LENGTH_LABELS[req.length]}</dd>
            <dt className="text-[#71717A]">Videos</dt><dd>{req.videoCount}</dd>
            <dt className="text-[#71717A]">Deadline</dt><dd>{new Date(req.deadline).toLocaleDateString()}</dd>
          </dl>
        </section>

        <section className="bg-white border border-[#E4E4E7] rounded p-6">
          <h2 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Pricing</h2>
          <p className="text-sm mb-2">Your offer: {formatUsd(req.offeredPricePerVideo)}/video</p>
          {req.status === 'COUNTER_OFFERED' && req.counterPricePerVideo != null && (
            <div className="border border-[#E4E4E7] rounded p-4 mt-3">
              <p className="text-sm font-medium mb-1">Counter offer: {formatUsd(req.counterPricePerVideo)}/video</p>
              {req.counterMessage && <p className="text-sm text-[#71717A] mb-4">{req.counterMessage}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => respond('accept')} className="px-3 py-1.5 text-sm bg-[#18181B] text-white rounded">Accept</button>
                <button type="button" onClick={() => respond('decline')} className="px-3 py-1.5 text-sm border border-[#E4E4E7] rounded">Decline</button>
              </div>
            </div>
          )}
          {req.agreedPricePerVideo != null && (
            <p className="text-sm font-medium mt-2">Agreed: {formatUsd(req.agreedPricePerVideo)}/video</p>
          )}
        </section>

        {req.milestones.length > 0 && (
          <section className="bg-white border border-[#E4E4E7] rounded p-6">
            <h2 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Timeline</h2>
            <ul className="space-y-2">
              {req.milestones.map((m) => (
                <li key={m.id} className={`text-sm ${m.completedAt ? 'text-[#71717A] line-through' : ''}`}>{m.label}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white border border-[#E4E4E7] rounded p-6">
          <h2 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Deliverables</h2>
          {req.deliverables.length === 0 ? (
            <p className="text-sm text-[#71717A]">Videos will appear here when ready.</p>
          ) : (
            <ul className="space-y-2">
              {req.deliverables.map((d) => (
                <li key={d.id}>
                  <a href={d.fileUrl} download className="text-sm underline">{d.fileName}</a>
                </li>
              ))}
            </ul>
          )}
          {req.status === 'DELIVERED' && (
            <button type="button" onClick={markComplete} className="mt-4 px-3 py-1.5 text-sm bg-[#18181B] text-white rounded">
              Mark complete
            </button>
          )}
        </section>
      </div>
    </FocusLayout>
  )
}
