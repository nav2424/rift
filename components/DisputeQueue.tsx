'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from './ui/GlassCard'

interface Dispute {
  id: string
  rift_id: string
  opened_by: string
  status: string
  reason: string
  category_snapshot: string
  summary: string
  auto_triage: any
  created_at: string
  rift?: {
    id: string
    riftNumber: number
    itemTitle: string
    subtotal: number
    currency: string
    itemType: string
    eventDateTz?: string | null
    buyer: { 
      id: string
      name: string | null
      email: string
      emailVerified?: boolean
      phoneVerified?: boolean
      idVerified?: boolean
      bankVerified?: boolean
    }
    seller: { 
      id: string
      name: string | null
      email: string
      emailVerified?: boolean
      phoneVerified?: boolean
      idVerified?: boolean
      bankVerified?: boolean
    }
  }
  openedByUser?: { 
    id: string
    name: string | null
    email: string
    emailVerified?: boolean
    phoneVerified?: boolean
    idVerified?: boolean
    bankVerified?: boolean
  }
}

export default function DisputeQueue() {
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    status: 'all',
    category: '',
    reason: '',
  })

  useEffect(() => {
    loadDisputes()
  }, [filters])

  const loadDisputes = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.category) params.append('category', filters.category)
      if (filters.reason) params.append('reason', filters.reason)

      const response = await fetch(`/api/admin/disputes?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.details || errorData.error || 'Failed to load disputes'
        setError(errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setDisputes(data.disputes || [])
    } catch (error: any) {
      console.error('Load disputes error:', error)
      if (!error.message || error.message === 'Failed to load disputes') {
        setError(error.message || 'Failed to load disputes. Please check your Supabase configuration.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'under_review':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'needs_info':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'auto_rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'resolved_buyer':
      case 'resolved_seller':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      default:
        return 'bg-white/10 text-white/60 border-white/20'
    }
  }

  if (loading) {
    return (
      <GlassCard>
        <div className="text-white/60 font-light text-center py-12">Loading disputes...</div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-white/60 text-sm font-light mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:border-white/30"
            >
              <option value="all">All Disputes</option>
              <option value="active">Active</option>
              <option value="submitted">Submitted</option>
              <option value="needs_info">Needs Info</option>
              <option value="under_review">Under Review</option>
              <option value="resolved_buyer">Resolved (Buyer)</option>
              <option value="resolved_seller">Resolved (Seller)</option>
              <option value="rejected">Rejected</option>
              <option value="auto_rejected">Auto Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-sm font-light mb-2">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:border-white/30"
            >
              <option value="">All</option>
              <option value="DIGITAL_GOODS">Digital Goods</option>
              <option value="SERVICES">Services</option>
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-sm font-light mb-2">Reason</label>
            <select
              value={filters.reason}
              onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
              className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:border-white/30"
            >
              <option value="">All</option>
              <option value="not_received">Not Received</option>
              <option value="not_as_described">Not As Described</option>
              <option value="unauthorized">Unauthorized</option>
              <option value="seller_nonresponsive">Seller Non-responsive</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Disputes List */}
      <GlassCard>
        {loading ? (
          <div className="text-white/60 font-light text-center py-12">
            Loading disputes...
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 font-light mb-2">Failed to load disputes</div>
            <div className="text-white/60 font-light text-sm max-w-2xl mx-auto whitespace-pre-line">
              {error}
            </div>
            {error.includes('Supabase configuration') && (
              <div className="mt-4 text-white/40 font-light text-xs">
                <p>Get your Supabase keys from:</p>
                <p className="mt-1">https://supabase.com/dashboard/project/zosvdbzroydrwwlwlzvi/settings/api</p>
              </div>
            )}
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-white/60 font-light text-center py-12">
            No disputes found
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <Link
                key={dispute.id}
                href={`/admin/disputes/${dispute.id}`}
                className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-medium">
                        Rift #{dispute.rift?.riftNumber || dispute.rift_id.slice(-4)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(dispute.status)}`}>
                        {dispute.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-white/80 font-light text-sm">{dispute.rift?.itemTitle}</p>
                  </div>
                  <div className="text-right text-sm text-white/60 font-light">
                    {new Date(dispute.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 font-light mt-3">
                  <span>Category: {dispute.category_snapshot}</span>
                  <span>Reason: {dispute.reason.replace(/_/g, ' ')}</span>
                  <span>Opened by: {dispute.openedByUser?.email || dispute.opened_by}</span>
                  {dispute.rift?.buyer && (
                    <span className="flex items-center gap-1.5">
                      Buyer: {dispute.rift.buyer.email}
                      {dispute.rift.buyer.emailVerified && dispute.rift.buyer.phoneVerified && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Email & Phone Verified" />
                      )}
                    </span>
                  )}
                  {dispute.rift?.seller && (
                    <span className="flex items-center gap-1.5">
                      Seller: {dispute.rift.seller.email}
                      {dispute.rift.seller.emailVerified && dispute.rift.seller.phoneVerified && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Email & Phone Verified" />
                      )}
                    </span>
                  )}
                  {dispute.auto_triage?.decision && (
                    <span className="text-yellow-400/80">
                      Auto: {dispute.auto_triage.decision}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

