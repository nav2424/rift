'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import FocusLayout from '@/components/layouts/FocusLayout'
import StatusBadge from '@/components/requests/StatusBadge'
import { formatUsd, scriptPreview } from '@/lib/video-requests'

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/brands', label: 'Brands' },
]

export default function AdminDashboardPage() {
  const [requests, setRequests] = useState<Array<{
    id: string
    requestNumber: number
    script: string
    status: string
    videoCount: number
    agreedPricePerVideo: number | null
    offeredPricePerVideo: number
    createdAt: string
    brand: { name: string | null; email: string }
  }>>([])

  useEffect(() => {
    fetch('/api/requests', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRequests(d.requests || []))
  }, [])

  const count = (s: string) => requests.filter((r) => r.status === s).length
  const negotiating = requests.filter((r) => ['COUNTER_OFFERED', 'NEGOTIATING'].includes(r.status)).length

  const now = new Date()
  const monthRevenue = requests
    .filter((r) => {
      const d = new Date(r.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, r) => {
      const p = r.agreedPricePerVideo ?? r.offeredPricePerVideo
      return sum + p * r.videoCount
    }, 0)

  const stats = [
    { label: 'Total requests', value: requests.length },
    { label: 'Pending review', value: count('PENDING_REVIEW') },
    { label: 'In production', value: count('IN_PRODUCTION') },
    { label: 'Delivered', value: count('DELIVERED') },
    { label: 'Revenue this month', value: formatUsd(monthRevenue) },
  ]

  return (
    <FocusLayout nav={ADMIN_NAV} title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-[#E4E4E7] rounded p-4">
            <p className="text-xs text-[#71717A] mb-1">{s.label}</p>
            <p className="text-xl font-medium">{s.value}</p>
          </div>
        ))}
      </div>

      {negotiating > 0 && (
        <p className="text-sm text-[#71717A] mb-6">{negotiating} request(s) in negotiation</p>
      )}

      <div className="bg-white border border-[#E4E4E7] rounded">
        <div className="px-4 py-3 border-b border-[#E4E4E7] flex justify-between items-center">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <Link href="/admin/requests" className="text-xs text-[#71717A] hover:text-[#18181B]">View all</Link>
        </div>
        <ul className="divide-y divide-[#E4E4E7]">
          {requests.slice(0, 8).map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm truncate">{scriptPreview(r.script, 60)}</p>
                <p className="text-xs text-[#71717A]">
                  {r.brand.name || r.brand.email} · #{r.requestNumber} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
          {requests.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-[#71717A]">No activity yet</li>
          )}
        </ul>
      </div>
    </FocusLayout>
  )
}
