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
    if (status === 'FUNDED') return 'Paid'
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

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20 mt-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-light text-white mb-2 tracking-tight">
                  Messages
                </h1>
                <p className="text-white/60 font-light">Your conversations</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-6" ref={searchRef}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search for a user or conversation..."
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 font-light focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                </div>
              )}
            </div>

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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                        <span className="text-blue-400 text-sm font-light">
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
          <GlassCard>
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-white mb-2">No conversations yet</h3>
              <p className="text-white/60 font-light text-sm mb-6">
                Conversations will appear here when you start messaging with other users
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
                  href={`/messages/${conv.id}`}
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
                          <p className="text-white/40 font-light text-xs">
                            {formatTime(conv.updatedAt)}
                          </p>
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
