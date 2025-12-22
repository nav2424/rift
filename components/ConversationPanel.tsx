'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { subscribeToMessages } from '@/lib/realtime-messaging'
import GlassCard from './ui/GlassCard'

interface Message {
  id: string
  body: string
  senderId: string | null
  createdAt: string
  readAt: string | null
}

interface ConversationPanelProps {
  conversationId: string
}

export default function ConversationPanel({ conversationId }: ConversationPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403) {
          setError('You do not have access to this conversation.')
        } else {
          const errorMessage = errorData.details 
            ? `${errorData.error || 'Failed to load messages'}: ${errorData.details}`
            : errorData.error || `Failed to load messages: ${response.status}`
          setError(errorMessage)
        }
        console.error('Failed to fetch messages:', response.status, errorData)
        return
      }

      const data = await response.json()
      setMessages(data.messages || [])
      setError(null)

      // Mark all messages in this conversation as read when user views them
      try {
        await fetch(`/api/conversations/${conversationId}/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })
      } catch (markReadError) {
        // Silently fail - marking as read is not critical
        console.debug('Failed to mark messages as read:', markReadError)
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      setError(err.message || 'Failed to load messages. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()

    return () => {
      // Cleanup realtime subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [conversationId])

  // Set up realtime subscription when conversationId is available
  useEffect(() => {
    if (!conversationId || !session?.user) return

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }

    // Subscribe to new messages
    unsubscribeRef.current = subscribeToMessages(
      conversationId,
      (newMessage) => {
        // Only add if we don't already have this message
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === newMessage.id)
          if (exists) return prev
          return [...prev, newMessage]
        })
      },
      (err) => {
        // Realtime subscription failed - this is non-critical
        // Messages will still work via polling/refresh, just without real-time updates
        console.warn('Realtime subscription unavailable:', err.message)
        // Don't set error state - messaging still works without realtime
      }
    )

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [conversationId, session?.user])

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!messageText.trim() || sending || !conversationId) return

    const textToSend = messageText.trim()
    setMessageText('')
    setSending(true)

    // Store optimistic message ID for cleanup
    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage: Message = {
      id: optimisticId,
      body: textToSend,
      senderId: session?.user?.id || null,
      createdAt: new Date().toISOString(),
      readAt: null,
    }

    try {
      // Optimistically add message to UI
      setMessages((prev) => [...prev, optimisticMessage])

      // Send to server (realtime will add the real message)
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ body: textToSend }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to send message: ${response.status}`)
      }

      const newMessage = await response.json()

      // Replace optimistic message with real one (in case realtime didn't fire)
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimisticId ? newMessage : msg))
      )
      setError(null)
    } catch (err: any) {
      console.error('Error sending message:', err)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      setMessageText(textToSend) // Restore message text
      setError(err.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center p-8">
          <div className="text-white/60 font-light">Loading messages...</div>
        </div>
      </GlassCard>
    )
  }

  if (error && messages.length === 0) {
    return (
      <GlassCard>
        <div className="p-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-8">
      <h2 className="text-xl font-light text-white mb-6">Messages</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4 mb-6 max-h-[600px] min-h-[400px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-white/60 font-light">
            Start the conversation.
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === session?.user?.id

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isMine
                      ? 'bg-blue-500/30 border border-blue-500/50'
                      : 'bg-white/10 border border-white/20'
                  }`}
                >
                  <p className="text-white text-sm mb-1">{message.body}</p>
                  <p className="text-white/50 text-xs">{formatTime(message.createdAt)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 border-t border-white/10 pt-4">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/40 font-light focus:outline-none focus:border-white/30"
          disabled={sending}
          maxLength={1000}
        />
        <button
          onClick={handleSend}
          disabled={!messageText.trim() || sending}
          className="px-6 py-2 bg-blue-500/30 border border-blue-500/50 rounded-xl text-white font-light hover:bg-blue-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </GlassCard>
  )
}
