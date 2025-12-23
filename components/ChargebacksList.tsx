'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface ChargebacksListProps {
  initialDisputes: any[]
}

export default function ChargebacksList({ initialDisputes }: ChargebacksListProps) {
  const [disputes, setDisputes] = useState(initialDisputes)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const { showToast } = useToast()
  const router = useRouter()

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (statusFilter) query.append('status', statusFilter)

      const response = await fetch(`/api/admin/stripe-disputes?${query.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch disputes')
      }
      const data = await response.json()
      setDisputes(data.disputes)
    } catch (error: any) {
      showToast(error.message || 'Failed to load disputes', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (statusFilter !== '') {
      fetchDisputes()
    }
  }, [statusFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs_response':
      case 'warning_needs_response':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'under_review':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'won':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'lost':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-white">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="needs_response">Needs Response</SelectItem>
            <SelectItem value="warning_needs_response">Warning Needs Response</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            setStatusFilter('')
            setDisputes(initialDisputes)
          }}
          variant="outline"
          className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
        >
          Clear Filters
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      ) : disputes.length === 0 ? (
        <p className="text-white/60 text-center py-10">No disputes found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10">
                <TableHead className="text-white/70">Dispute ID</TableHead>
                <TableHead className="text-white/70">Rift ID</TableHead>
                <TableHead className="text-white/70">Status</TableHead>
                <TableHead className="text-white/70">Amount</TableHead>
                <TableHead className="text-white/70">Reason</TableHead>
                <TableHead className="text-white/70">Evidence Due</TableHead>
                <TableHead className="text-white/70">Created</TableHead>
                <TableHead className="text-white/70">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white/[0.02]">
              {disputes.map((dispute) => (
                <TableRow key={dispute.id} className="border-white/10 hover:bg-white/[0.03]">
                  <TableCell className="font-mono text-sm text-white/90">
                    {dispute.stripe_dispute_id.slice(-8)}
                  </TableCell>
                  <TableCell className="text-white/80">
                    {dispute.rift_id ? (
                      <Link href={`/admin/rifts/${dispute.rift_id}`} className="hover:underline">
                        {dispute.rift_id.slice(-8)}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(dispute.status)}>
                      {dispute.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/80">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: dispute.currency || 'CAD',
                    }).format(dispute.amount_cents / 100)}
                  </TableCell>
                  <TableCell className="text-white/80">
                    {dispute.reason || 'N/A'}
                  </TableCell>
                  <TableCell className="text-white/80">
                    {dispute.evidence_due_by
                      ? format(new Date(dispute.evidence_due_by), 'MMM dd, yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="text-white/80">
                    {format(new Date(dispute.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/chargebacks/${dispute.stripe_dispute_id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                      >
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

