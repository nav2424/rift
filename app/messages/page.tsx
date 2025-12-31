'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { subscribeToUserConversations } from '@/lib/realtime-messaging'
import { useToast } from '@/components/ui/Toast'

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
  const { showToast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

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
      const conversationsList = data.conversations || []
      setConversations(conversationsList)
      setAllConversations(conversationsList) // Fix: Set allConversations for search functionality
      setError(null)
    } catch (err: any) {
      console.error('Error fetching conversations:', err)
      const errorMessage = 'Failed to load conversations. Please try again.'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      fetchConversations()

      // Subscribe to new conversations (with error handling)
      if (session?.user?.id) {
        try {
          unsubscribeRef.current = subscribeToUserConversations(
            session.user.id,
            () => {
              // Refresh conversations when a new one is created
              fetchConversations()
            },
            (err) => {
              // Log as warning since subscription errors are often transient
              console.warn('Realtime subscription warning:', err.message || err)
            }
          )
        } catch (err: any) {
          // If subscription fails, log but don't crash the page
          console.warn('Failed to subscribe to conversations:', err)
        }
      }
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [status, session, router])

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
    if (status === 'FUNDED' || status === 'PAID') return 'Paid'
    return status.replace(/_/g, ' ')
  }

  // Debounce timer for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Search for users
  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to search users')
      }

      const data = await response.json()
      // Filter out current user and users we already have conversations with
      const existingUserIds = new Set(allConversations.map(c => c.otherParticipant?.id).filter(Boolean))
      const filteredUsers = (data.users || []).filter(
        (user: any) => user.id !== session?.user?.id && !existingUserIds.has(user.id)
      )
      setSearchResults(filteredUsers)
    } catch (err: any) {
      console.error('Error searching users:', err)
      setSearchResults([])
      showToast('Failed to search users. Please try again.', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  // Handle search input change with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Filter existing conversations immediately
    if (query.trim()) {
      const filtered = allConversations.filter(conv => {
        const displayName = conv.otherParticipant?.name || conv.otherParticipant?.email || ''
        const email = conv.otherParticipant?.email || ''
        const searchLower = query.toLowerCase()
        return (
          displayName.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower) ||
          conv.transactionTitle.toLowerCase().includes(searchLower)
        )
      })
      setConversations(filtered)
      
      // Debounce user search (wait 300ms after user stops typing)
      if (query.length >= 2) {
        searchTimeoutRef.current = setTimeout(() => {
          searchUsers(query)
        }, 300)
      } else {
        setSearchResults([])
      }
    } else {
      setConversations(allConversations)
      setSearchResults([])
    }
  }

  // Create new conversation with a user
  const createConversationWithUser = async (userId: string, userName: string) => {
    try {
      // Check if there's an existing conversation with this user
      const existingConv = allConversations.find(
        conv => conv.otherParticipant?.id === userId
      )

      if (existingConv) {
        // Navigate to existing conversation
        router.push(`/messages/${existingConv.id}`)
      } else {
        // For now, show a message that they need to create a transaction first
        // In the future, you could create a direct message conversation
        const errorMessage = `To message ${userName}, you need to create a Rift transaction with them first.`
        setError(errorMessage)
        showToast(errorMessage, 'info')
        setSearchQuery('')
        setSearchResults([])
      }
    } catch (err: any) {
      console.error('Error creating conversation:', err)
      const errorMessage = 'Failed to start conversation. Please try again.'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    }
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

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="mb-10 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/10 flex items-center justify-center border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
              <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-1">
                Messages
              </h1>
              <p className="text-white/50 font-light text-sm">Your conversations</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative" ref={searchRef}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search for a user or conversation..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-cyan-500/30 focus:bg-white/8 transition-all duration-200"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}

            {/* Search Results Dropdown */}
            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2">
                  <p className="text-xs text-white/60 font-light px-3 py-2 uppercase tracking-wider">New Conversations</p>
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => createConversationWithUser(user.id, user.name || user.email)}
                      className="w-full px-3 py-3 text-left hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/10 flex items-center justify-center border border-cyan-500/20 flex-shrink-0">
                        <span className="text-cyan-400 text-sm font-light">
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-light truncate">{user.name || 'No name'}</p>
                        <p className="text-white/60 text-sm font-light truncate">{user.email}</p>
                      </div>
                      <svg className="w-5 h-5 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <GlassCard className="mb-6 border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </GlassCard>
        )}

        {conversations.length === 0 ? (
          <GlassCard variant="strong" className="overflow-hidden">
            <div className="p-16 text-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
                <svg className="w-12 h-12 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-light text-white mb-3">No conversations yet</h3>
              <p className="text-white/50 font-light">
                {searchQuery ? 'Try a different search query' : 'Conversations will appear here when you start messaging with other users'}
              </p>
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
                  href={`/messages/${conv.id}`}
                  className="block"
                >
                  <GlassCard className="hover:bg-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer group">
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                              <h3 className="text-white font-light text-lg mb-1">{displayName}</h3>
                              <p className="text-white/80 font-light leading-relaxed">{conv.transactionTitle}</p>
                            </div>
                            <span className="text-white/40 font-light text-xs whitespace-nowrap flex-shrink-0 pt-1">
                              {formatTime(conv.updatedAt)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 flex-wrap">
                            {conv.transactionStatus && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-light border ${statusColors.bg} ${statusColors.text}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                                {getStatusLabel(conv.transactionStatus)}
                              </span>
                            )}
                            {conv.lastMessage ? (
                              <span className={`text-sm font-light ${
                                isLastMessageMine ? 'text-white/60' : 'text-white/70'
                              }`}>
                                {isLastMessageMine && <span className="text-white/40">You: </span>}
                                {conv.lastMessage.isSystem 
                                  ? `---- ${conv.lastMessage.body} ----`
                                  : conv.lastMessage.body}
                              </span>
                            ) : (
                              <span className="text-white/40 font-light text-sm italic">No messages yet</span>
                            )}
                            {conv.unreadCount > 0 && (
                              <span className="ml-auto px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-light border border-cyan-500/30">
                                {conv.unreadCount} new
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
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
