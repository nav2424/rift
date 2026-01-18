'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import { useToast } from '@/components/ui/Toast'

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

export default function SupportTicketsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadTickets()
    }
  }, [status, router, filterStatus])

  const loadTickets = async () => {
    try {
      setLoading(true)
      const url = filterStatus === 'all' 
        ? '/api/support/tickets'
        : `/api/support/tickets?status=${filterStatus}`
      
      const response = await fetch(url, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load tickets')
      }

      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (error) {
      console.error('Error loading tickets:', error)
      showToast('Failed to load tickets', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newTicket),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create ticket')
      }

      const data = await response.json()
      showToast('Support ticket created successfully', 'success')
      setShowCreateForm(false)
      setNewTicket({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' })
      loadTickets()
    } catch (error: any) {
      console.error('Error creating ticket:', error)
      showToast(error.message || 'Failed to create ticket', 'error')
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
      CLOSED: 'bg-white/10 text-white/60 border-white/20',
    }
    return (
      <span className={`px-2 py-1 text-xs font-light rounded border ${styles[status as keyof typeof styles] || 'bg-white/10 text-white/60 border-white/20'}`}>
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
      <span className={`px-2 py-1 text-xs font-light rounded border ${styles[priority as keyof typeof styles] || 'bg-white/10 text-white/60 border-white/20'}`}>
        {priority}
      </span>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-white/10 rounded w-1/3"></div>
            <div className="grid grid-cols-1 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-white/10 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-2">
              Support Tickets
            </h1>
            <p className="text-white/60 font-light">
              View and manage your support requests
            </p>
          </div>
          <PremiumButton
            onClick={() => setShowCreateForm(!showCreateForm)}
            variant="outline"
          >
            {showCreateForm ? 'Cancel' : 'Create Ticket'}
          </PremiumButton>
        </div>

        {/* Create Ticket Form */}
        {showCreateForm && (
          <GlassCard className="p-6 mb-8">
            <h2 className="text-xl font-light text-white mb-4">Create Support Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 font-light mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 font-light mb-2">
                  Description *
                </label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[120px]"
                  placeholder="Please provide details about your issue..."
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 font-light mb-2">
                    Category
                  </label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="GENERAL">General</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="ACCOUNT">Account</option>
                    <option value="PAYMENT">Payment</option>
                    <option value="DISPUTE">Dispute</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 font-light mb-2">
                    Priority
                  </label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <PremiumButton
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </PremiumButton>
                <PremiumButton type="submit">
                  Create Ticket
                </PremiumButton>
              </div>
            </form>
          </GlassCard>
        )}

        {/* Filter */}
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm text-white/60 font-light">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="all">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
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
            <Link key={ticket.id} href={`/support/tickets/${ticket.id}`}>
              <GlassCard className="p-6 hover:bg-white/5 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-light text-white">
                        #{ticket.ticketNumber} - {ticket.title}
                      </h3>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <p className="text-white/60 font-light line-clamp-2">
                      {ticket.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-white/50 font-light">
                  <div className="flex items-center gap-4">
                    <span>{ticket.category}</span>
                    {ticket.assignedTo && (
                      <span>Assigned to {ticket.assignedTo.name || ticket.assignedTo.email}</span>
                    )}
                  </div>
                  <span>Created {formatDate(ticket.createdAt)}</span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>

        {tickets.length === 0 && !loading && (
          <GlassCard className="p-12 text-center">
            <p className="text-white/60 font-light text-lg">
              No tickets found{filterStatus !== 'all' ? ` with status "${filterStatus}"` : ''}
            </p>
            {!showCreateForm && (
              <PremiumButton
                onClick={() => setShowCreateForm(true)}
                variant="outline"
                className="mt-4"
              >
                Create Your First Ticket
              </PremiumButton>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  )
}
