'use client'

import { useEffect, useState } from 'react'
import FocusLayout from '@/components/layouts/FocusLayout'
import { formatUsd } from '@/lib/video-requests'

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/brands', label: 'Brands' },
]

interface BrandRow {
  id: string
  name: string | null
  email: string
  joinedAt: string
  totalRequests: number
  totalSpend: number
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [selected, setSelected] = useState<BrandRow | null>(null)

  useEffect(() => {
    fetch('/api/admin/brands', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBrands(d.brands || []))
  }, [])

  return (
    <FocusLayout nav={ADMIN_NAV} title="Brands">
      <div className="bg-white border border-[#E4E4E7] rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] text-left text-[#71717A]">
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Requests</th>
              <th className="px-4 py-3 font-medium">Total spend</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} onClick={() => setSelected(b)} className="border-b border-[#E4E4E7] cursor-pointer hover:bg-[#FAFAFA]">
                <td className="px-4 py-3 font-medium">{b.name || '—'}</td>
                <td className="px-4 py-3 text-[#71717A]">{b.email}</td>
                <td className="px-4 py-3">{b.totalRequests}</td>
                <td className="px-4 py-3">{formatUsd(b.totalSpend)}</td>
                <td className="px-4 py-3">{new Date(b.joinedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-[#71717A]">No brands yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelected(null)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-[#E4E4E7] z-50 p-6">
            <button type="button" onClick={() => setSelected(null)} className="text-sm text-[#71717A] mb-6">Close</button>
            <h2 className="text-lg font-medium mb-1">{selected.name || selected.email}</h2>
            <p className="text-sm text-[#71717A] mb-6">{selected.email}</p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-[#71717A]">Total requests</dt><dd>{selected.totalRequests}</dd></div>
              <div className="flex justify-between"><dt className="text-[#71717A]">Total spend</dt><dd>{formatUsd(selected.totalSpend)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#71717A]">Joined</dt><dd>{new Date(selected.joinedAt).toLocaleDateString()}</dd></div>
            </dl>
          </div>
        </>
      )}
    </FocusLayout>
  )
}
