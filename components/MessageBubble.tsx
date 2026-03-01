'use client'

import { useState } from 'react'

interface MessageBubbleProps {
  message: {
    id: string
    body: string
    senderId: string | null
    createdAt: string
    readAt: string | null
  }
  isMine: boolean
  formatTime: (dateString: string) => string
}

export default function MessageBubble({ message, isMine, formatTime }: MessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null)

  // Get user's preferred language from browser
  const getUserLanguage = () => {
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language || navigator.languages?.[0] || 'en'
      return browserLang.split('-')[0] // Get language code (e.g., 'en' from 'en-US')
    }
    return 'en'
  }

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslation(!showTranslation)
      return
    }
    
    setTranslating(true)
    try {
      const targetLanguage = getUserLanguage()
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.body, targetLanguage }),
      })
      if (response.ok) {
        const data = await response.json()
        setTranslatedText(data.translatedText)
        setDetectedLanguage(data.sourceLanguage)
        setShowTranslation(true)
      }
    } catch (error) {
      console.error('Translation failed:', error)
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div
      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isMine
            ? 'bg-blue-500/30 border border-blue-500/50'
            : 'bg-gray-100 border border-gray-300'
        }`}
      >
        <p className="text-[#1d1d1f] text-sm mb-1">
          {showTranslation && translatedText ? translatedText : message.body}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[#86868b] text-xs">{formatTime(message.createdAt)}</p>
          {!isMine && (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="text-xs text-gray-400 hover:text-[#86868b] ml-2 transition-colors"
              title={showTranslation 
                ? `Show original (${detectedLanguage?.toUpperCase() || 'Original'})` 
                : `Translate to ${getUserLanguage().toUpperCase()}`
              }
            >
              {translating ? '...' : showTranslation ? 'Show original' : '🌐'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

