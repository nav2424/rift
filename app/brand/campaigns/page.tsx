'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { campaignStatusColor, campaignStatusLabel } from '@/lib/campaigns'

interface Campaign {
  id: string
  campaignNumber: number
  productName: string
  videoCount: number
  videoFormat: string
  budget: number
  currency: string
  status: string
  deadline: string
  paidAt: string | null
  assignments: Array<{
    id: string
    status: string
    videoFilePath: string | null
    videoFileName: string | null
  }>
  milestones: Array<{ label: string; completedAt: string | null }>
}

const USAGE_RIGHTS = [
  { value: 'ORGANIC_ONLY', label: 'Organic only' },
  { value: 'PAID_ADS', label: 'Paid ads' },
  { value: 'WHITELISTING', label: 'Whitelisting' },
  { value: 'FULL_BUYOUT', label: 'Full buyout' },
]

export default function BrandCampaignsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    productName: '',
    talkingPoints: '',
    videoFormat: '9:16 vertical, 30s',
    videoCount: '3',
    usageRights: 'ORGANIC_ONLY',
    deadline: '',
    budget: '',
    currency: 'CAD',
  })

  const loadCampaigns = async () => {
    const res = await fetch('/api/campaigns?brand=true', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status !== 'authenticated') return
    loadCampaigns().finally(() => setLoading(false))
  }, [status, router])

  const formatCurrency = (amount: number, currency = 'CAD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          videoCount: Number(form.videoCount),
          budget: Number(form.budget),
        }),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({
          productName: '',
          talkingPoints: '',
          videoFormat: '9:16 vertical, 30s',
          videoCount: '3',
          usageRights: 'ORGANIC_ONLY',
          deadline: '',
          budget: '',
          currency: 'CAD',
        })
        await loadCampaigns()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handlePay = async (campaignId: string) => {
    const res = await fetch(`/api/campaigns/${campaignId}/payment-intent`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      if (data.clientSecret?.startsWith('mock_')) {
        alert('Payment simulated in dev mode. Campaign marked awaiting payment.')
      } else {
        alert('Payment intent created. Complete checkout via Stripe (integration pending UI).')
      }
      await loadCampaigns()
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#86868b]">Loading campaigns...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">Campaigns</h1>
          <p className="mt-1 text-[#86868b] text-sm">
            Submit briefs, pay upfront, and receive finished UGC videos through Rift.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all"
        >
          {showForm ? 'Cancel' : 'New Campaign Brief'}
        </button>
      </div>

      {showForm && (
        <GlassCard className="border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-[#1d1d1f] mb-4">Submit campaign brief</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Product / brand name</label>
              <input
                required
                value={form.productName}
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="e.g. Glow Serum Skincare"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Talking points</label>
              <textarea
                required
                rows={4}
                value={form.talkingPoints}
                onChange={(e) => setForm((f) => ({ ...f, talkingPoints: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Key messages, hooks, dos and don'ts..."
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Video format</label>
              <input
                required
                value={form.videoFormat}
                onChange={(e) => setForm((f) => ({ ...f, videoFormat: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Number of videos</label>
              <input
                required
                type="number"
                min={1}
                value={form.videoCount}
                onChange={(e) => setForm((f) => ({ ...f, videoCount: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Usage rights</label>
              <select
                value={form.usageRights}
                onChange={(e) => setForm((f) => ({ ...f, usageRights: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {USAGE_RIGHTS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Deadline</label>
              <input
                required
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] uppercase tracking-wider">Campaign budget</label>
              <input
                required
                type="number"
                min={1}
                step="0.01"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Submit brief
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      <GlassCard className="border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Your campaigns</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-[#86868b] text-sm">
              No campaigns yet. Submit your first brief to get started.
            </div>
          ) : (
            campaigns.map((campaign) => {
              const approvedVideos = campaign.assignments.filter((a) => a.status === 'APPROVED' && a.videoFilePath)
              return (
                <div key={campaign.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">
                        {campaign.productName}
                        <span className="text-[#86868b] font-normal ml-2">#{campaign.campaignNumber}</span>
                      </p>
                      <p className="text-xs text-[#86868b] mt-1">
                        {campaign.videoCount} videos · {campaign.videoFormat} · Due{' '}
                        {new Date(campaign.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${campaignStatusColor(campaign.status as never)}`}>
                        {campaignStatusLabel(campaign.status as never)}
                      </span>
                      <span className="text-sm font-medium">{formatCurrency(campaign.budget, campaign.currency)}</span>
                    </div>
                  </div>

                  {!campaign.paidAt && ['BRIEF_SUBMITTED', 'AWAITING_PAYMENT'].includes(campaign.status) && (
                    <button
                      type="button"
                      onClick={() => handlePay(campaign.id)}
                      className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Pay campaign budget
                    </button>
                  )}

                  {approvedVideos.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#86868b] uppercase tracking-wider mb-2">Delivered videos</p>
                      <div className="flex flex-wrap gap-2">
                        {approvedVideos.map((a) => (
                          <a
                            key={a.id}
                            href={a.videoFilePath!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            {a.videoFileName || 'Download video'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {campaign.milestones?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {campaign.milestones.map((m) => (
                        <span
                          key={m.label}
                          className={`text-[10px] px-2 py-1 rounded-full border ${
                            m.completedAt ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-[#86868b]'
                          }`}
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </GlassCard>

      <p className="text-xs text-[#86868b] text-center">
        Questions about a campaign?{' '}
        <Link href="/messages" className="text-blue-600 hover:underline">Message the Rift team</Link>
        {' '}— creators never see your brand details.
      </p>
    </div>
  )
}
