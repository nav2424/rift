'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { subscribeToMessages } from '@/lib/realtime-messaging'
import { useToast } from '@/components/ui/Toast'

interface Message {
  id: string
  body: string
  senderId: string | null
  createdAt: string
  readAt: string | null
}

interface MessagingPanelProps {
  transactionId: string
}

export default function MessagingPanel({ transactionId }: MessagingPanelProps) {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/conversations/transaction/${transactionId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403) {
          const errorMessage = 'You do not have access to this conversation.'
          setError(errorMessage)
          showToast(errorMessage, 'error')
        } else {
          // Show detailed error message if available
          const errorMessage = errorData.details 
            ? `${errorData.error || 'Failed to load messages'}: ${errorData.details}`
            : errorData.error || `Failed to load messages: ${response.status}`
          setError(errorMessage)
          showToast(errorMessage, 'error')
        }
        console.error('Failed to fetch messages:', response.status, errorData)
        return
      }

      const data = await response.json()
      if (!data.conversation || !data.conversation.id) {
        throw new Error('Invalid response: missing conversation data')
      }
      setConversationId(data.conversation.id)
      setMessages(data.messages || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      const errorMessage = err.message || 'Failed to load messages. Please try again.'
      setError(errorMessage)
      showToast(errorMessage, 'error')
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
  }, [transactionId])

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
        console.error('Realtime subscription error:', err)
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
    // Only scroll messages container to bottom when messages change, but not on initial load
    // This prevents auto-scrolling the whole page when the component first mounts
    if (messages.length > 0 && !loading && messagesContainerRef.current) {
      // Scroll the container itself, not the whole page
      const container = messagesContainerRef.current
      const timeout = setTimeout(() => {
        container.scrollTop = container.scrollHeight
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [messages, loading])

  const handleSend = async () => {
    if (!messageText.trim() || sending || !transactionId) return

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
      const response = await fetch(`/api/conversations/transaction/${transactionId}`, {
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
      const errorMessage = err.message || 'Failed to send message. Please try again.'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      setMessageText(textToSend) // Restore message text
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
      <div className="flex items-center justify-center p-8">
        <div className="text-white/60 font-light">Loading messages...</div>
      </div>
    )
  }

  if (error && messages.length === 0) {
    return (
      <div className="p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8 pb-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-400/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-xl font-light text-white">Messages</h2>
      </div>

      <div 
        ref={messagesContainerRef} 
        className="space-y-4 mb-8 max-h-[800px] overflow-y-auto pr-3 -mr-3 custom-scrollbar min-h-[500px] px-4 py-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent',
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/50 font-light text-sm">Start the conversation for this transaction</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === session?.user?.id

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3.5 shadow-xl transition-all duration-200 ${
                    isMine
                      ? 'bg-gradient-to-br from-blue-500/50 to-blue-600/40 border border-blue-400/40 backdrop-blur-md hover:from-blue-500/60 hover:to-blue-600/50'
                      : 'bg-white/8 border border-white/15 backdrop-blur-md hover:bg-white/12 hover:border-white/20'
                  }`}
                >
                  <p className="text-white text-[15px] font-light leading-relaxed mb-2 break-words">{message.body}</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <p className={`text-[11px] ${isMine ? 'text-blue-100/60' : 'text-white/35'} font-light tracking-wide`}>
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-4 border-t border-white/10 pt-6 mt-6">
        <div className="flex-1 relative">
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
            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder:text-white/35 font-light text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/40 transition-all backdrop-blur-sm hover:bg-white/8 hover:border-white/15"
            disabled={sending}
            maxLength={1000}
          />
          {messageText.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-[10px] text-white/30 font-light">{messageText.length}/1000</span>
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!messageText.trim() || sending}
          className="px-6 py-3.5 bg-gradient-to-r from-blue-500/60 to-blue-600/50 border border-blue-400/40 rounded-xl text-white font-light text-sm hover:from-blue-500/70 hover:to-blue-600/60 hover:border-blue-400/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-500/60 disabled:hover:to-blue-600/50 backdrop-blur-sm shadow-lg hover:shadow-xl hover:shadow-blue-500/20 active:scale-[0.98] flex items-center gap-2"
        >
          {sending ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Sending</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Send</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

