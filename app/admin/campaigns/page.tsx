'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { campaignStatusColor, campaignStatusLabel, assignmentStatusLabel } from '@/lib/campaigns'

interface Campaign {
  id: string
  campaignNumber: number
  productName: string
  budget: number
  currency: string
  status: string
  deadline: string
  paidAt: string | null
  creatorRatePerVideo: number | null
  brand: { name: string | null; email: string }
  assignments: Array<{
    id: string
    status: string
    payoutStatus: string
    payoutAmount: number | null
    videoFilePath: string | null
    videoFileName: string | null
    revisionNotes: string | null
    creator: { id: string; name: string | null; email: string }
  }>
}

interface Creator {
  id: string
  name: string | null
  email: string
}

export default function AdminCampaignsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [assignForm, setAssignForm] = useState<Record<string, { creatorId: string; rate: string }>>({})

  const load = async () => {
    const [campaignsRes, usersRes] = await Promise.all([
      fetch('/api/campaigns', { credentials: 'include' }),
      fetch('/api/users/search?q=&role=creator', { credentials: 'include' }).catch(() => null),
    ])
    if (campaignsRes.ok) {
      const data = await campaignsRes.json()
      setCampaigns(data.campaigns || [])
    }
    if (usersRes?.ok) {
      const data = await usersRes.json()
      setCreators(data.users || data || [])
    } else {
      setCreators([])
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    if (status !== 'authenticated') return
    load().finally(() => setLoading(false))
  }, [status, session, router])

  const assignCreator = async (campaignId: string) => {
    const form = assignForm[campaignId]
    if (!form?.creatorId) return
    await fetch(`/api/campaigns/${campaignId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        creatorEmail: form.creatorId,
        payoutAmount: form.rate ? Number(form.rate) : undefined,
      }),
    })
    await load()
  }

  const updateAssignment = async (assignmentId: string, body: Record<string, string>) => {
    await fetch(`/api/campaigns/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    await load()
  }

  const deliverCampaign = async (campaignId: string) => {
    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'DELIVERED' }),
    })
    await load()
  }

  const formatCurrency = (amount: number, currency = 'CAD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  if (loading) {
    return <div className="p-8 text-[#86868b]">Loading campaigns...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Campaign Management</h1>
            <p className="mt-1 text-[#86868b] text-sm">Review briefs, assign creators, approve content, trigger payouts.</p>
          </div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">← Admin home</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 border border-gray-200">
            <p className="text-xs text-[#86868b]">Total campaigns</p>
            <p className="text-2xl font-semibold">{campaigns.length}</p>
          </GlassCard>
          <GlassCard className="p-4 border border-gray-200">
            <p className="text-xs text-[#86868b]">Awaiting review</p>
            <p className="text-2xl font-semibold">{campaigns.filter((c) => c.status === 'UNDER_REVIEW').length}</p>
          </GlassCard>
          <GlassCard className="p-4 border border-gray-200">
            <p className="text-xs text-[#86868b]">In production</p>
            <p className="text-2xl font-semibold">{campaigns.filter((c) => ['CREATORS_ASSIGNED', 'IN_PRODUCTION', 'CONTENT_UPLOADED'].includes(c.status)).length}</p>
          </GlassCard>
          <GlassCard className="p-4 border border-gray-200">
            <p className="text-xs text-[#86868b]">Delivered</p>
            <p className="text-2xl font-semibold text-emerald-600">{campaigns.filter((c) => c.status === 'DELIVERED').length}</p>
          </GlassCard>
        </div>

        <div className="space-y-6">
          {campaigns.map((campaign) => (
            <GlassCard key={campaign.id} className="border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-medium text-[#1d1d1f]">
                    #{campaign.campaignNumber} · {campaign.productName}
                  </p>
                  <p className="text-xs text-[#86868b] mt-1">
                    Brand: {campaign.brand.name || campaign.brand.email} ·{' '}
                    {formatCurrency(campaign.budget, campaign.currency)} ·{' '}
                    {campaign.paidAt ? 'Paid' : 'Unpaid'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${campaignStatusColor(campaign.status as never)}`}>
                  {campaignStatusLabel(campaign.status as never)}
                </span>
              </div>

              {campaign.status === 'UNDER_REVIEW' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-medium text-[#86868b] mb-2">Assign creator</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="email"
                      placeholder="Creator email"
                      value={assignForm[campaign.id]?.creatorId || ''}
                      onChange={(e) =>
                        setAssignForm((f) => ({
                          ...f,
                          [campaign.id]: { ...f[campaign.id], creatorId: e.target.value, rate: f[campaign.id]?.rate || '' },
                        }))
                      }
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg flex-1 min-w-[200px]"
                    />
                    <input
                      type="number"
                      placeholder="Rate per video"
                      value={assignForm[campaign.id]?.rate || ''}
                      onChange={(e) =>
                        setAssignForm((f) => ({
                          ...f,
                          [campaign.id]: { creatorId: f[campaign.id]?.creatorId || '', rate: e.target.value },
                        }))
                      }
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-32"
                    />
                    <button
                      type="button"
                      onClick={() => assignCreator(campaign.id)}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Assign
                    </button>
                  </div>
                  {creators.length > 0 && (
                    <p className="text-[10px] text-[#86868b] mt-2">
                      Tip: paste a creator user ID from the users list.
                    </p>
                  )}
                </div>
              )}

              {campaign.assignments.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#86868b] uppercase tracking-wider">Creator assignments</p>
                  {campaign.assignments.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 border border-gray-100 rounded-lg">
                      <div>
                        <p className="text-sm text-[#1d1d1f]">{a.creator.name || a.creator.email}</p>
                        <p className="text-xs text-[#86868b]">
                          {assignmentStatusLabel(a.status as never)} · Payout: {a.payoutStatus}
                          {a.payoutAmount != null && ` · ${formatCurrency(a.payoutAmount, campaign.currency)}`}
                        </p>
                        {a.videoFilePath && (
                          <a href={a.videoFilePath} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            {a.videoFileName || 'View video'}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {a.status === 'UPLOADED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateAssignment(a.id, { status: 'APPROVED' })}
                              className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const notes = prompt('Revision notes for creator:')
                                if (notes) updateAssignment(a.id, { status: 'REVISION_REQUESTED', revisionNotes: notes })
                              }}
                              className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200"
                            >
                              Request revision
                            </button>
                          </>
                        )}
                        {a.status === 'APPROVED' && a.payoutStatus === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => updateAssignment(a.id, { payoutStatus: 'PAID' })}
                            className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                          >
                            Mark paid
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {campaign.status === 'CONTENT_REVIEWED' && (
                <button
                  type="button"
                  onClick={() => deliverCampaign(campaign.id)}
                  className="mt-4 px-4 py-2 text-sm bg-[#1d1d1f] text-white rounded-xl hover:bg-gray-800"
                >
                  Deliver to brand
                </button>
              )}
            </GlassCard>
          ))}

          {campaigns.length === 0 && (
            <GlassCard className="p-8 text-center text-[#86868b] text-sm border border-gray-200">
              No campaigns yet.
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
