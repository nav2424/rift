'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PremiumButton from './ui/PremiumButton'

interface Message {
  id: string
  body: string
  senderId: string | null
  createdAt: string
  readAt: string | null
}

interface MessagingPreviewProps {
  transactionId: string
}

export default function MessagingPreview({ transactionId }: MessagingPreviewProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/conversations/transaction/${transactionId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!data.conversation || !data.conversation.id) {
          return
        }
        
        const convId = data.conversation.id
        setConversationId(convId)
        const msgs = data.messages || []
        // Only show last 2 messages for preview
        setMessages(msgs.slice(-2))
      } catch (err) {
        console.error('Error fetching messages:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [transactionId])

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

  const handleOpenConversation = () => {
    if (conversationId) {
      // Pass transactionId as query param so the conversation page knows which rift to link back to
      router.push(`/messages/${conversationId}?riftId=${transactionId}`)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-gray-400 font-light text-xs">Loading messages...</div>
      </div>
    )
  }

  // If no conversation exists, we can't open it yet
  if (!conversationId) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-sm font-light text-[#86868b]">Messages</h3>
        </div>
        <p className="text-gray-400 font-light text-xs">No conversation yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-sm font-light text-gray-600">Messages</h3>
        </div>
        <PremiumButton
          variant="ghost"
          onClick={handleOpenConversation}
          className="text-xs px-3 py-1.5 min-h-[28px] text-blue-400/80 hover:text-blue-400"
        >
          Open →
        </PremiumButton>
      </div>

      {messages.length === 0 ? (
        <div className="py-4 text-center border-t border-gray-100 pt-4">
          <p className="text-gray-400 font-light text-xs mb-3">No messages yet</p>
          <PremiumButton
            variant="outline"
            onClick={handleOpenConversation}
            className="text-xs px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-blue-400/30 hover:from-blue-500/30 hover:to-blue-600/30"
          >
            Start Conversation
          </PremiumButton>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-2 -mr-2 custom-scrollbar">
          {messages.map((message) => {
            const isMine = message.senderId === session?.user?.id
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 ${
                    isMine
                      ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/25 border border-blue-400/30'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <p className="text-[#1d1d1f] text-xs font-light leading-relaxed break-words line-clamp-3">
                    {message.body}
                  </p>
                  <p className={`text-[9px] mt-1.5 ${isMine ? 'text-blue-100/50' : 'text-gray-400'} font-light`}>
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
