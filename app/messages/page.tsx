'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { subscribeToUserConversations } from '@/lib/realtime-messaging'

interface Conversation {
  id: string
  transactionId: string | null
  transactionTitle: string
  transactionStatus: string | null
  otherParticipant: {
    id: string
    name: string | null
    email: string
  } | null
  lastMessage: {
    id: string
    body: string
    senderId: string | null
    isSystem?: boolean
    createdAt: string
  } | null
  updatedAt: string
  unreadCount: number
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }

      const data = await response.json()
      setConversations(data.conversations || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching conversations:', err)
      setError('Failed to load conversations. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      fetchConversations()

      // Subscribe to new conversations
      if (session?.user?.id) {
        unsubscribeRef.current = subscribeToUserConversations(
          session.user.id,
          () => {
            // Refresh conversations when a new one is created
            fetchConversations()
          },
          (err) => {
            console.warn('Realtime subscription warning:', err.message || err)
          }
        )
      }
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [status, session, router])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = (status: string | null) => {
    if (!status) return { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' }
    switch (status) {
      case 'RELEASED':
        return { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' }
      case 'REFUNDED':
        return { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' }
      case 'DISPUTED':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' }
      case 'CANCELLED':
        return { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' }
      default:
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' }
    }
  }

  const getStatusLabel = (status: string | null) => {
    if (!status) return 'Unknown'
    return status.replace(/_/g, ' ')
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading conversations...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tight">
                  Messages
                </h1>
                <p className="text-white/60 font-light">Your conversations</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-white/60 hover:text-white font-light text-sm disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <GlassCard className="mb-6 border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </GlassCard>
        )}

        {conversations.length === 0 ? (
          <GlassCard>
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-white mb-2">No conversations yet</h3>
              <p className="text-white/60 font-light text-sm mb-6">
                Start a conversation from any transaction detail page
              </p>
              <Link 
                href="/rifts"
                className="inline-block px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-white font-light text-sm"
              >
                View Your Rifts
              </Link>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {conversations.map((conv) => {
              const isLastMessageMine = conv.lastMessage?.senderId === session?.user?.id
              const displayName = conv.otherParticipant?.name || conv.otherParticipant?.email || 'Unknown'
              const statusColors = getStatusColor(conv.transactionStatus)

              return (
                <Link
                  key={conv.id}
                  href={conv.transactionId ? `/escrows/${conv.transactionId}` : '#'}
                  className="block"
                >
                  <GlassCard className="hover:bg-white/5 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/10">
                    <div className="p-6">
                      {/* Header Row */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-light text-white mb-2 truncate">{displayName}</h3>
                          {conv.transactionStatus && (
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${statusColors.bg} border border-current/20`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                              <span className={`text-xs font-light uppercase tracking-wide ${statusColors.text}`}>
                                {getStatusLabel(conv.transactionStatus)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-white/40 font-light text-xs mb-2">
                            {formatTime(conv.updatedAt)}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="inline-block bg-blue-500/30 text-blue-300 text-xs px-2 py-1 rounded-full font-light">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Transaction Title */}
                      <p className="text-white/80 font-light text-sm mb-3 truncate">
                        {conv.transactionTitle}
                      </p>

                      {/* Last Message */}
                      {conv.lastMessage ? (
                        <div className="pt-3 border-t border-white/10">
                          <p className={`text-sm font-light truncate ${
                            isLastMessageMine ? 'text-white/60' : 'text-white/70'
                          }`}>
                            {isLastMessageMine && <span className="text-white/40">You: </span>}
                            {conv.lastMessage.isSystem 
                              ? `---- ${conv.lastMessage.body} ----`
                              : conv.lastMessage.body}
                          </p>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-white/10">
                          <p className="text-white/40 font-light text-sm italic">No messages yet</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
