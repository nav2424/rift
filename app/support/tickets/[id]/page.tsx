'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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

export default function SupportTicketDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { showToast } = useToast()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const ticketId = params?.id as string

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && ticketId) {
      loadTicket()
    }
  }, [status, router, ticketId])

  const loadTicket = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load ticket')
      }

      const data = await response.json()
      setTicket(data.ticket)
    } catch (error) {
      console.error('Error loading ticket:', error)
      showToast('Failed to load ticket', 'error')
      router.push('/support/tickets')
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
      <span className={`px-3 py-1 text-sm font-light rounded border ${styles[status as keyof typeof styles] || 'bg-white/10 text-white/60 border-white/20'}`}>
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
      <span className={`px-3 py-1 text-sm font-light rounded border ${styles[priority as keyof typeof styles] || 'bg-white/10 text-white/60 border-white/20'}`}>
        {priority}
      </span>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-white/10 rounded w-1/3"></div>
            <div className="h-64 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !ticket) {
    return null
  }

  const conversation = ticket.conversationHistory || []

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/support/tickets"
            className="text-white/60 hover:text-white font-light flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Tickets
          </Link>
        </div>

        {/* Ticket Header */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-light text-white">
                  Ticket #{ticket.ticketNumber}
                </h1>
                {getStatusBadge(ticket.status)}
                {getPriorityBadge(ticket.priority)}
              </div>
              <h2 className="text-xl font-light text-white mb-2">{ticket.title}</h2>
              <div className="text-sm text-white/60 font-light space-y-1">
                <p>Category: {ticket.category}</p>
                {ticket.assignedTo && (
                  <p>Assigned to: {ticket.assignedTo.name || ticket.assignedTo.email}</p>
                )}
                {ticket.RiftTransaction && (
                  <p>
                    Related Rift:{' '}
                    <Link
                      href={`/rifts/${ticket.RiftTransaction.id}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Rift #{ticket.RiftTransaction.riftNumber}
                    </Link>
                  </p>
                )}
                <p>Created: {formatDate(ticket.createdAt)}</p>
                {ticket.resolvedAt && (
                  <p>Resolved: {formatDate(ticket.resolvedAt)}</p>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Conversation */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-lg font-light text-white mb-4">Conversation</h2>
          <div className="space-y-4">
            {/* Initial description */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-light text-white">{ticket.createdBy.name || ticket.createdBy.email}</span>
                <span className="text-xs text-white/50 font-light">{formatDate(ticket.createdAt)}</span>
              </div>
              <p className="text-white/80 font-light whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Conversation history */}
            {conversation.map((msg, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  msg.role === 'admin'
                    ? 'bg-blue-500/10 border-blue-500/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-light text-white">
                    {msg.role === 'admin' ? 'Admin' : ticket.createdBy.name || ticket.createdBy.email}
                  </span>
                  <span className="text-xs text-white/50 font-light">{formatDate(msg.timestamp)}</span>
                </div>
                <p className="text-white/80 font-light whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Add Message (only if ticket is not resolved/closed) */}
        {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
          <GlassCard className="p-6">
            <h2 className="text-lg font-light text-white mb-4">Add Message</h2>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-light focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[120px]"
                placeholder="Type your message here..."
                required
              />
              <div className="flex justify-end">
                <PremiumButton type="submit" disabled={sending || !message.trim()}>
                  {sending ? 'Sending...' : 'Send Message'}
                </PremiumButton>
              </div>
            </form>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
