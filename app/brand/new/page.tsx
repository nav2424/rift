'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FocusLayout from '@/components/layouts/FocusLayout'

const BRAND_NAV = [
  { href: '/brand/requests', label: 'Requests' },
  { href: '/brand/new', label: 'New request' },
]

export default function BrandNewRequestPage() {
  const router = useRouter()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    script: '',
    styleNotes: '',
    format: 'VERTICAL_9_16',
    length: 'SEC_30',
    videoCount: '1',
    offeredPricePerVideo: '',
    deadline: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          videoCount: Number(form.videoCount),
          offeredPricePerVideo: Number(form.offeredPricePerVideo),
        }),
      })
      if (res.ok) setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <FocusLayout nav={BRAND_NAV} title="New request">
        <div className="max-w-lg mx-auto bg-white border border-[#E4E4E7] rounded p-10 text-center">
          <h2 className="text-lg font-medium mb-2">Request submitted</h2>
          <p className="text-sm text-[#71717A] mb-6">
            We&apos;ll review your request within 24 hours.
          </p>
          <button type="button" onClick={() => router.push('/brand/requests')} className="text-sm px-4 py-2 bg-[#18181B] text-white rounded">
            View requests
          </button>
        </div>
      </FocusLayout>
    )
  }

  return (
    <FocusLayout nav={BRAND_NAV} title="New request">
      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        <div>
          <label className="block text-xs text-[#71717A] mb-1">Script / talking points</label>
          <textarea
            required
            rows={8}
            value={form.script}
            onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white"
            placeholder="What should the creator say or demonstrate?"
          />
        </div>
        <div>
          <label className="block text-xs text-[#71717A] mb-1">Video style notes</label>
          <textarea
            rows={3}
            value={form.styleNotes}
            onChange={(e) => setForm((f) => ({ ...f, styleNotes: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white"
            placeholder="Tone, pacing, hooks, things to avoid…"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#71717A] mb-1">Format</label>
            <select value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white">
              <option value="VERTICAL_9_16">9:16 vertical</option>
              <option value="HORIZONTAL_16_9">16:9 horizontal</option>
              <option value="SQUARE_1_1">1:1 square</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#71717A] mb-1">Length</label>
            <select value={form.length} onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white">
              <option value="SEC_15">15 seconds</option>
              <option value="SEC_30">30 seconds</option>
              <option value="SEC_60">60 seconds</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#71717A] mb-1">Number of videos</label>
            <input type="number" min={1} required value={form.videoCount} onChange={(e) => setForm((f) => ({ ...f, videoCount: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white" />
          </div>
          <div>
            <label className="block text-xs text-[#71717A] mb-1">Price per video (USD)</label>
            <input type="number" min={1} step="0.01" required value={form.offeredPricePerVideo} onChange={(e) => setForm((f) => ({ ...f, offeredPricePerVideo: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#71717A] mb-1">Deadline</label>
          <input type="date" required value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded bg-white" />
        </div>
        <button type="submit" disabled={submitting} className="px-4 py-2.5 text-sm bg-[#18181B] text-white rounded disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </FocusLayout>
  )
}
