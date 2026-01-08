'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function Chatbot() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "I'm RIFT AI. I can help you understand how Rift works, guide you through transactions, and explain our processes. How can I assist you?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId: session?.user?.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const text = await response.text()
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from server')
      }

      let data
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        console.error('Failed to parse chatbot response:', parseError)
        throw new Error('Invalid response format')
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Handle escalation if needed
      if (data.escalate) {
        setTimeout(() => {
          alert(`This issue requires human assistance. ${data.ticket ? 'A support ticket has been created.' : 'Please contact support@rift.com for immediate help.'}`)
        }, 100)
      }
    } catch (error) {
      console.error('Chatbot error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-20 w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-110"
          aria-label="Open chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <>
          {/* Backdrop - click to close on mobile */}
          <div 
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
          />
          {/* Chat Window Container - Centered on mobile, bottom-right on desktop */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:inset-auto md:bottom-4 md:right-4 md:z-20 md:p-0">
            <div className="w-full max-w-lg h-[85vh] max-h-[700px] md:w-96 md:h-[600px] bg-black/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-medium">Rift Assistant</h3>
                <p className="text-xs text-white/60">AI-powered support</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close chatbot"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/90'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap chatbot-message">
                    {message.content.split('\n').map((line, index, array) => {
                      const trimmedLine = line.trim()
                      const isEmpty = trimmedLine === ''
                      
                      // Check if line is a numbered list item (e.g., "1. ", "2. ")
                      const isNumberedItem = /^\d+\.\s/.test(trimmedLine)
                      
                      // Check previous line
                      const prevLine = index > 0 ? array[index - 1].trim() : ''
                      const prevIsEmpty = prevLine === ''
                      const prevIsNumbered = index > 0 && /^\d+\.\s/.test(prevLine)
                      
                      // Add extra spacing before first numbered item (after empty line or non-numbered content)
                      if (isNumberedItem && !prevIsNumbered && index > 0) {
                        return (
                          <div key={index} className={prevIsEmpty ? 'mt-1' : 'mt-4'}>
                            {line}
                          </div>
                        )
                      }
                      
                      // Regular numbered item - keep close spacing
                      if (isNumberedItem) {
                        return (
                          <div key={index} className="mt-1">
                            {line}
                          </div>
                        )
                      }
                      
                      // Empty line - add spacing
                      if (isEmpty) {
                        return <div key={index} className="h-2" />
                      }
                      
                      // Regular text line - add moderate spacing
                      return (
                        <div key={index} className={index > 0 ? 'mt-2' : ''}>
                          {line}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 rounded-2xl px-4 py-2">
                  <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center text-white transition-colors"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-white/40 mt-2 text-center">
              AI responses may be inaccurate. For critical issues, contact support.
            </p>
          </form>
            </div>
          </div>
        </>
      )}
    </>
  )
}

