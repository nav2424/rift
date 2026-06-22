'use client'

import { useEffect, useState, useCallback } from 'react'
import FocusLayout from '@/components/layouts/FocusLayout'
import StatusBadge from '@/components/requests/StatusBadge'
import { FORMAT_LABELS, LENGTH_LABELS, formatUsd, scriptPreview } from '@/lib/video-requests'

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/brands', label: 'Brands' },
]

interface RequestRow {
  id: string
  requestNumber: number
  script: string
  videoCount: number
  offeredPricePerVideo: number
  counterPricePerVideo: number | null
  agreedPricePerVideo: number | null
  status: string
  deadline: string
  createdAt: string
  styleNotes: string | null
  format: string
  length: string
  counterMessage: string | null
  adminNotes: string | null
  brand: { name: string | null; email: string }
  milestones: Array<{ id: string; label: string; sortOrder: number; completedAt: string | null }>
  deliverables: Array<{ id: string; fileName: string; fileUrl: string; uploadedAt: string }>
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [selected, setSelected] = useState<RequestRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterMsg, setCounterMsg] = useState('')
  const [milestoneLabel, setMilestoneLabel] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [showCounter, setShowCounter] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/requests', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setRequests(data.requests || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const refreshSelected = async (id: string) => {
    const res = await fetch(`/api/requests/${id}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setSelected(data.request)
      await load()
    }
  }

  const openRow = async (row: RequestRow) => {
    const res = await fetch(`/api/requests/${row.id}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setSelected(data.request)
      setAdminNotes(data.request.adminNotes || '')
      setShowCounter(false)
    }
  }

  const post = async (path: string, body?: object) => {
    if (!selected) return
    await fetch(`/api/requests/${selected.id}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })
    await refreshSelected(selected.id)
  }

  const saveNotes = async () => {
    if (!selected) return
    await fetch(`/api/requests/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ adminNotes }),
    })
    await refreshSelected(selected.id)
  }

  const addMilestone = async () => {
    if (!selected || !milestoneLabel.trim()) return
    await fetch(`/api/requests/${selected.id}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ label: milestoneLabel }),
    })
    setMilestoneLabel('')
    await refreshSelected(selected.id)
  }

  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    if (!selected) return
    await fetch(`/api/requests/${selected.id}/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completed }),
    })
    await refreshSelected(selected.id)
  }

  const uploadFile = async (file: File) => {
    if (!selected) return
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`/api/requests/${selected.id}/deliverables`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    await refreshSelected(selected.id)
  }

  const brandName = (r: RequestRow) => r.brand.name || r.brand.email.split('@')[0]

  return (
    <FocusLayout nav={ADMIN_NAV} title="Requests" flush>
      {loading ? (
        <p className="text-sm text-[#71717A] p-8">Loading…</p>
      ) : (
        <div className="bg-white border-y border-[#E4E4E7] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] text-left text-[#71717A]">
                <th className="px-4 py-3 font-medium">Brand</th>
                <th className="px-4 py-3 font-medium">Videos</th>
                <th className="px-4 py-3 font-medium">Offered / video</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#71717A]">No requests yet</td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openRow(r)}
                    className="border-b border-[#E4E4E7] cursor-pointer hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{brandName(r)}</p>
                      <p className="text-xs text-[#71717A] truncate max-w-xs">{scriptPreview(r.script, 50)}</p>
                    </td>
                    <td className="px-4 py-3">{r.videoCount}</td>
                    <td className="px-4 py-3">{formatUsd(r.offeredPricePerVideo)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">{new Date(r.deadline).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelected(null)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-[#E4E4E7] z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E4E4E7] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#71717A]">Request #{selected.requestNumber}</p>
                <p className="font-medium">{brandName(selected)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[#71717A] text-sm">Close</button>
            </div>

            <div className="p-6 space-y-8">
              <section>
                <h3 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Details</h3>
                <p className="text-sm whitespace-pre-wrap mb-3">{selected.script}</p>
                {selected.styleNotes && <p className="text-sm text-[#71717A] mb-2">{selected.styleNotes}</p>}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-[#71717A]">Format</dt>
                  <dd>{FORMAT_LABELS[selected.format]}</dd>
                  <dt className="text-[#71717A]">Length</dt>
                  <dd>{LENGTH_LABELS[selected.length]}</dd>
                  <dt className="text-[#71717A]">Videos</dt>
                  <dd>{selected.videoCount}</dd>
                  <dt className="text-[#71717A]">Deadline</dt>
                  <dd>{new Date(selected.deadline).toLocaleDateString()}</dd>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Pricing</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-[#71717A]">Offered</dt><dd>{formatUsd(selected.offeredPricePerVideo)}/video</dd></div>
                  {selected.counterPricePerVideo != null && (
                    <div className="flex justify-between"><dt className="text-[#71717A]">Counter</dt><dd>{formatUsd(selected.counterPricePerVideo)}/video</dd></div>
                  )}
                  {selected.agreedPricePerVideo != null && (
                    <div className="flex justify-between font-medium"><dt>Agreed</dt><dd>{formatUsd(selected.agreedPricePerVideo)}/video</dd></div>
                  )}
                </dl>
                {selected.counterMessage && (
                  <p className="mt-2 text-sm text-[#71717A] border border-[#E4E4E7] rounded p-3">{selected.counterMessage}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {['PENDING_REVIEW', 'NEGOTIATING'].includes(selected.status) && (
                    <button type="button" onClick={() => post('/accept')} className="px-3 py-1.5 text-sm border border-[#18181B] rounded">
                      Accept price
                    </button>
                  )}
                  <button type="button" onClick={() => setShowCounter(!showCounter)} className="px-3 py-1.5 text-sm border border-[#E4E4E7] rounded">
                    Counter offer
                  </button>
                </div>
                {showCounter && (
                  <div className="mt-3 space-y-2">
                    <input type="number" step="0.01" placeholder="Counter price per video" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded" />
                    <textarea placeholder="Message to brand" value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded" />
                    <button type="button" onClick={() => post('/counter', { counterPricePerVideo: Number(counterPrice), counterMessage: counterMsg })} className="px-3 py-1.5 text-sm bg-[#18181B] text-white rounded">
                      Send counter
                    </button>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Timeline</h3>
                <ul className="space-y-2 mb-3">
                  {(selected.milestones || []).map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span className={m.completedAt ? 'line-through text-[#71717A]' : ''}>{m.label}</span>
                      <button type="button" onClick={() => toggleMilestone(m.id, !m.completedAt)} className="text-xs text-[#71717A] underline">
                        {m.completedAt ? 'Undo' : 'Done'}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input value={milestoneLabel} onChange={(e) => setMilestoneLabel(e.target.value)} placeholder="New milestone" className="flex-1 px-3 py-2 text-sm border border-[#E4E4E7] rounded" />
                  <button type="button" onClick={addMilestone} className="px-3 py-2 text-sm border border-[#E4E4E7] rounded">Add</button>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Deliverables</h3>
                <ul className="space-y-2 mb-3">
                  {(selected.deliverables || []).map((d) => (
                    <li key={d.id}>
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">{d.fileName}</a>
                    </li>
                  ))}
                </ul>
                <label className="block text-sm border border-dashed border-[#E4E4E7] rounded p-4 text-center text-[#71717A] cursor-pointer">
                  Upload file
                  <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
                </label>
              </section>

              <section>
                <h3 className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-3">Internal notes</h3>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded mb-2" />
                <button type="button" onClick={saveNotes} className="text-sm text-[#71717A] underline">Save notes</button>
              </section>

              <section className="flex flex-wrap gap-2 pt-4 border-t border-[#E4E4E7]">
                {['AGREED', 'IN_PRODUCTION'].includes(selected.status) && selected.status !== 'IN_PRODUCTION' && (
                  <button type="button" onClick={() => post('/status', { action: 'in_production' })} className="px-3 py-1.5 text-sm bg-[#18181B] text-white rounded">
                    Mark in production
                  </button>
                )}
                {selected.status === 'IN_PRODUCTION' && (
                  <button type="button" onClick={() => post('/status', { action: 'delivered' })} className="px-3 py-1.5 text-sm bg-[#18181B] text-white rounded">
                    Mark delivered
                  </button>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </FocusLayout>
  )
}
