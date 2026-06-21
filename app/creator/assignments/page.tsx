'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { assignmentStatusLabel } from '@/lib/campaigns'

interface Assignment {
  id: string
  status: string
  payoutAmount: number | null
  payoutStatus: string
  revisionNotes: string | null
  videoFilePath: string | null
  videoFileName: string | null
  uploadedAt: string | null
  campaign: {
    id: string
    campaignNumber: number
    productName: string
    videoFormat: string
    videoCount: number
    usageRights: string
    deadline: string
    sanitizedBrief: string | null
    status: string
    currency: string
  }
}

export default function CreatorAssignmentsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const loadAssignments = async () => {
    const res = await fetch('/api/campaigns/assignments', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setAssignments(data.assignments || [])
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status !== 'authenticated') return
    loadAssignments().finally(() => setLoading(false))
  }, [status, router])

  const handleUpload = async (assignmentId: string, file: File) => {
    setUploadingId(assignmentId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/campaigns/assignments/${assignmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      })
      if (res.ok) await loadAssignments()
    } finally {
      setUploadingId(null)
    }
  }

  const formatCurrency = (amount: number, currency = 'CAD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#86868b]">Loading assignments...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">Assignments</h1>
        <p className="mt-1 text-[#86868b] text-sm">
          Briefs from Rift — brand details are never shared. Upload your videos when ready.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs text-[#86868b] uppercase tracking-wider">Active</p>
          <p className="text-2xl font-semibold text-[#1d1d1f]">
            {assignments.filter((a) => !['APPROVED'].includes(a.status)).length}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs text-[#86868b] uppercase tracking-wider">Approved</p>
          <p className="text-2xl font-semibold text-emerald-600">
            {assignments.filter((a) => a.status === 'APPROVED').length}
          </p>
        </GlassCard>
        <GlassCard className="p-5 border border-gray-200 bg-white">
          <p className="text-xs text-[#86868b] uppercase tracking-wider">Pending payout</p>
          <p className="text-2xl font-semibold text-[#1d1d1f]">
            {formatCurrency(
              assignments
                .filter((a) => a.payoutStatus === 'PENDING' && a.status === 'APPROVED')
                .reduce((sum, a) => sum + (a.payoutAmount || 0), 0)
            )}
          </p>
        </GlassCard>
      </div>

      <div className="space-y-4">
        {assignments.length === 0 ? (
          <GlassCard className="border border-gray-200 bg-white p-8 text-center">
            <p className="text-[#86868b] text-sm">No assignments yet. Rift will assign you campaigns internally.</p>
          </GlassCard>
        ) : (
          assignments.map((assignment) => (
            <GlassCard key={assignment.id} className="border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-medium text-[#1d1d1f]">
                    Campaign #{assignment.campaign.campaignNumber}
                  </p>
                  <p className="text-xs text-[#86868b] mt-1">
                    {assignment.campaign.videoFormat} · Due{' '}
                    {new Date(assignment.campaign.deadline).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                  {assignmentStatusLabel(assignment.status as never)}
                </span>
              </div>

              {assignment.campaign.sanitizedBrief && (
                <pre className="text-xs text-[#1d1d1f] whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4 font-sans leading-relaxed">
                  {assignment.campaign.sanitizedBrief}
                </pre>
              )}

              {assignment.revisionNotes && (
                <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                  <strong>Revision requested:</strong> {assignment.revisionNotes}
                </div>
              )}

              {assignment.payoutAmount != null && (
                <p className="text-xs text-[#86868b] mb-3">
                  Rate: {formatCurrency(assignment.payoutAmount, assignment.campaign.currency)} · Payout: {assignment.payoutStatus}
                </p>
              )}

              {['ASSIGNED', 'IN_PROGRESS', 'REVISION_REQUESTED'].includes(assignment.status) && (
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                  {uploadingId === assignment.id ? 'Uploading...' : 'Upload video'}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={uploadingId === assignment.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(assignment.id, file)
                    }}
                  />
                </label>
              )}

              {assignment.videoFilePath && (
                <a
                  href={assignment.videoFilePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-emerald-600 hover:underline"
                >
                  View uploaded file
                </a>
              )}
            </GlassCard>
          ))
        )}
      </div>

      <p className="text-xs text-[#86868b] text-center">
        Need clarification?{' '}
        <Link href="/messages" className="text-emerald-600 hover:underline">Message Rift</Link>
        {' '}— never the brand directly.
      </p>
    </div>
  )
}
