'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FocusLayout from '@/components/layouts/FocusLayout'
import StatusBadge from '@/components/requests/StatusBadge'
import { formatUsd, scriptPreview } from '@/lib/video-requests'

const BRAND_NAV = [
  { href: '/brand/requests', label: 'Requests' },
  { href: '/brand/new', label: 'New request' },
]

export default function BrandRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<Array<{
    id: string
    requestNumber: number
    script: string
    status: string
    offeredPricePerVideo: number
    counterPricePerVideo: number | null
    agreedPricePerVideo: number | null
    deadline: string
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/requests', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) router.push('/auth/signin')
        return r.json()
      })
      .then((d) => setRequests(d.requests || []))
      .finally(() => setLoading(false))
  }, [router])

  const priceLabel = (r: (typeof requests)[0]) => {
    if (r.agreedPricePerVideo != null) return `Agreed ${formatUsd(r.agreedPricePerVideo)}/video`
    if (r.counterPricePerVideo != null) return `Counter ${formatUsd(r.counterPricePerVideo)}/video`
    return `Offered ${formatUsd(r.offeredPricePerVideo)}/video`
  }

  return (
    <FocusLayout nav={BRAND_NAV} title="Requests">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#71717A]">Track your video requests</p>
        <Link href="/brand/new" className="text-sm px-4 py-2 bg-[#18181B] text-white rounded">
          New request
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[#71717A]">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-[#E4E4E7] rounded p-12 text-center">
          <p className="text-sm text-[#71717A] mb-4">No requests yet</p>
          <Link href="/brand/new" className="text-sm underline">Submit your first request</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/brand/requests/${r.id}`}
              className="block bg-white border border-[#E4E4E7] rounded p-5 hover:border-[#18181B]"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-sm font-medium">#{r.requestNumber}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-[#71717A] mb-3 line-clamp-2">{scriptPreview(r.script, 120)}</p>
              <div className="flex justify-between text-xs text-[#71717A]">
                <span>{priceLabel(r)}</span>
                <span>Due {new Date(r.deadline).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </FocusLayout>
  )
}
