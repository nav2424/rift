'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  conversationHistory: Array<{
    role: 'user' | 'admin'
    content: string
    timestamp: string
    adminId?: string
  }> | null
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
  resolvedBy: {
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

export default function AdminSupportTicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { showToast } = useToast()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateData, setUpdateData] = useState({
    status: '',
    priority: '',
    assignedToId: '',
  })

  const ticketId = params?.id as string

  useEffect(() => {
    if (ticketId) {
      loadTicket()
    }
  }, [ticketId])

  const loadTicket = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin')
          return
        }
        throw new Error('Failed to load ticket')
      }

      const data = await response.json()
      setTicket(data.ticket)
      setUpdateData({
        status: data.ticket.status,
        priority: data.ticket.priority,
        assignedToId: data.ticket.assignedToId || '',
      })
    } catch (error) {
      console.error('Error loading ticket:', error)
      showToast('Failed to load ticket', 'error')
      router.push('/admin/support')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim()) {
      return
    }

    try {
      setSending(true)
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: message.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      setMessage('')
      showToast('Message sent successfully', 'success')
      loadTicket()
    } catch (error: any) {
      console.error('Error sending message:', error)
      showToast(error.message || 'Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleUpdateTicket = async () => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: updateData.status,
          priority: updateData.priority,
          assignedToId: updateData.assignedToId || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update ticket')
      }

      showToast('Ticket updated successfully', 'success')
      loadTicket()
    } catch (error: any) {
      console.error('Error updating ticket:', error)
      showToast(error.message || 'Failed to update ticket', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleResolve = async () => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolved: true }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve ticket')
      }

      showToast('Ticket resolved successfully', 'success')
      loadTicket()
    } catch (error: any) {
      console.error('Error resolving ticket:', error)
      showToast(error.message || 'Failed to resolve ticket', 'error')
    } finally {
      setUpdating(false)
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
      <span className={`px-3 py-1 text-sm font-light rounded border ${styles[status as keyof typeof styles] || 'bg-gray-100 text-[#86868b] border-gray-300'}`}>
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
      <span className={`px-3 py-1 text-sm font-light rounded border ${styles[priority as keyof typeof styles] || 'bg-gray-100 text-[#86868b] border-gray-300'}`}>
        {priority}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-100 rounded w-1/3"></div>
            <div className="h-64 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return null
  }

  const conversation = ticket.conversationHistory || []

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/support"
            className="text-[#86868b] hover:text-[#1d1d1f] font-light flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Support Tickets
          </Link>
        </div>

        {/* Ticket Header */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-light text-[#1d1d1f]">
                  Ticket #{ticket.ticketNumber}
                </h1>
                {getStatusBadge(ticket.status)}
                {getPriorityBadge(ticket.priority)}
              </div>
              <h2 className="text-xl font-light text-[#1d1d1f] mb-4">{ticket.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#86868b] font-light">
                <div>
                  <p className="text-gray-700 mb-1">Created by:</p>
                  <p>{ticket.createdBy.name || ticket.createdBy.email}</p>
                  {ticket.createdBy.riftUserId && (
                    <p className="font-mono text-xs">{ticket.createdBy.riftUserId}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-700 mb-1">Category:</p>
                  <p>{ticket.category}</p>
                </div>
                {ticket.RiftTransaction && (
                  <div>
                    <p className="text-gray-700 mb-1">Related Rift:</p>
                    <Link
                      href={`/rifts/${ticket.RiftTransaction.id}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Rift #{ticket.RiftTransaction.riftNumber} - {ticket.RiftTransaction.itemTitle}
                    </Link>
                  </div>
                )}
                <div>
                  <p className="text-gray-700 mb-1">Created:</p>
                  <p>{formatDate(ticket.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Ticket Management (Admin) */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-lg font-light text-[#1d1d1f] mb-4">Manage Ticket</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-[#86868b] font-light mb-2">Status</label>
              <select
                value={updateData.status}
                onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#86868b] font-light mb-2">Priority</label>
              <select
                value={updateData.priority}
                onChange={(e) => setUpdateData({ ...updateData, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#86868b] font-light mb-2">Assign To</label>
              <input
                type="text"
                value={updateData.assignedToId}
                onChange={(e) => setUpdateData({ ...updateData, assignedToId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="User ID (optional)"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <PremiumButton onClick={handleUpdateTicket} disabled={updating}>
              {updating ? 'Updating...' : 'Update Ticket'}
            </PremiumButton>
            {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
              <PremiumButton onClick={handleResolve} variant="outline" disabled={updating}>
                Mark as Resolved
              </PremiumButton>
            )}
          </div>
        </GlassCard>

        {/* Conversation */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-lg font-light text-[#1d1d1f] mb-4">Conversation</h2>
          <div className="space-y-4">
            {/* Initial description */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-light text-[#1d1d1f]">{ticket.createdBy.name || ticket.createdBy.email}</span>
                <span className="text-xs text-[#86868b] font-light">{formatDate(ticket.createdAt)}</span>
              </div>
              <p className="text-gray-700 font-light whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Conversation history */}
            {conversation.map((msg, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  msg.role === 'admin'
                    ? 'bg-blue-500/10 border-blue-500/20'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-light text-[#1d1d1f]">
                    {msg.role === 'admin' ? 'Admin' : ticket.createdBy.name || ticket.createdBy.email}
                  </span>
                  <span className="text-xs text-[#86868b] font-light">{formatDate(msg.timestamp)}</span>
                </div>
                <p className="text-gray-700 font-light whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Add Message */}
        <GlassCard className="p-6">
          <h2 className="text-lg font-light text-[#1d1d1f] mb-4">Add Response</h2>
          <form onSubmit={handleSendMessage} className="space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300 min-h-[120px]"
              placeholder="Type your response here..."
              required
            />
            <div className="flex justify-end">
              <PremiumButton type="submit" disabled={sending || !message.trim()}>
                {sending ? 'Sending...' : 'Send Response'}
              </PremiumButton>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  )
}
