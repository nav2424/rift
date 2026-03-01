'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

interface SupportTicket {
  id: string
  ticketNumber: number
  title: string
  description: string
  status: string
  priority: string
  category: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  createdBy: {
    id: string
    name: string | null
    email: string
    riftUserId: string | null
  }
  assignedTo: {
    id: string
    name: string | null
    email: string
  } | null
  RiftTransaction: {
    id: string
    riftNumber: number
    itemTitle: string
  } | null
}

export default function AdminSupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date')

  useEffect(() => {
    loadTickets()
  }, [filterStatus, filterCategory])

  const loadTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.append('status', filterStatus)
      if (filterCategory !== 'all') params.append('category', filterCategory)
      
      const url = `/api/support/tickets${params.toString() ? '?' + params.toString() : ''}`
      
      const response = await fetch(url, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin')
          return
        }
        throw new Error('Failed to load tickets')
      }

      const data = await response.json()
      
      // Sort tickets
      const sorted = [...(data.tickets || [])].sort((a, b) => {
        if (sortBy === 'priority') {
          const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                 (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
        } else {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
      })
      
      setTickets(sorted)
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      OPEN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/30',
      CLOSED: 'bg-gray-100 text-[#86868b] border-gray-300',
    }
    return (
      <span className={`px-2 py-1 text-xs font-light rounded border ${styles[status as keyof typeof styles] || 'bg-gray-100 text-[#86868b] border-gray-300'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const styles = {
      LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return (
      <span className={`px-2 py-1 text-xs font-light rounded border ${styles[priority as keyof typeof styles] || 'bg-gray-100 text-[#86868b] border-gray-300'}`}>
        {priority}
      </span>
    )
  }

  const getStats = () => {
    const open = tickets.filter(t => t.status === 'OPEN').length
    const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length
    const resolved = tickets.filter(t => t.status === 'RESOLVED').length
    const critical = tickets.filter(t => t.priority === 'CRITICAL').length
    return { open, inProgress, resolved, critical, total: tickets.length }
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-100 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] tracking-tight mb-2">
              Support Tickets
            </h1>
            <p className="text-[#86868b] font-light">
              Manage and respond to user support requests
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </Link>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Open Tickets</p>
              <p className="text-4xl font-light text-yellow-400 mb-2 tracking-tight">{stats.open}</p>
              <p className="text-sm text-gray-400 font-light">Awaiting response</p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">In Progress</p>
              <p className="text-4xl font-light text-blue-400 mb-2 tracking-tight">{stats.inProgress}</p>
              <p className="text-sm text-gray-400 font-light">Being handled</p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Critical</p>
              <p className="text-4xl font-light text-red-400 mb-2 tracking-tight">{stats.critical}</p>
              <p className="text-sm text-gray-400 font-light">High priority</p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Total Tickets</p>
              <p className="text-4xl font-light text-[#1d1d1f] mb-2 tracking-tight">{stats.total}</p>
              <p className="text-sm text-gray-400 font-light">All statuses</p>
            </div>
          </GlassCard>
        </div>

        {/* Filters and Sort */}
        <GlassCard className="p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#86868b] font-light">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="all">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#86868b] font-light">Category:</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="all">All Categories</option>
                <option value="TECHNICAL">Technical</option>
                <option value="ACCOUNT">Account</option>
                <option value="PAYMENT">Payment</option>
                <option value="DISPUTE">Dispute</option>
                <option value="GENERAL">General</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#86868b] font-light">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="date">Date (Newest)</option>
                <option value="priority">Priority</option>
              </select>
            </div>
            <PremiumButton
              onClick={loadTickets}
              variant="ghost"
              className="ml-auto"
            >
              Refresh
            </PremiumButton>
          </div>
        </GlassCard>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/admin/support/${ticket.id}`}>
              <GlassCard className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-light text-[#1d1d1f]">
                        Ticket #{ticket.ticketNumber}
                      </h3>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <h4 className="text-lg font-light text-[#1d1d1f] mb-2">{ticket.title}</h4>
                    <p className="text-[#86868b] font-light line-clamp-2 mb-3">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-[#86868b] font-light">
                      <span>Category: {ticket.category}</span>
                      {ticket.assignedTo ? (
                        <span>Assigned to: {ticket.assignedTo.name || ticket.assignedTo.email}</span>
                      ) : (
                        <span className="text-yellow-400/80">Unassigned</span>
                      )}
                      {ticket.RiftTransaction && (
                        <Link
                          href={`/rifts/${ticket.RiftTransaction.id}`}
                          className="text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Rift #{ticket.RiftTransaction.riftNumber}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-[#86868b] font-light">
                  <div>
                    <span>Created by: {ticket.createdBy.name || ticket.createdBy.email}</span>
                    {ticket.createdBy.riftUserId && (
                      <span className="ml-2 font-mono">({ticket.createdBy.riftUserId})</span>
                    )}
                  </div>
                  <span>{formatDate(ticket.createdAt)}</span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>

        {tickets.length === 0 && !loading && (
          <GlassCard className="p-12 text-center">
            <p className="text-[#86868b] font-light text-lg">
              No tickets found
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
