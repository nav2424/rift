'use client'

import { useState, useEffect, useRef } from 'react'
import { useToast } from './ui/Toast'
import PremiumButton from './ui/PremiumButton'

interface DeliveryViewerProps {
  riftId: string
  delivery: {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
  }
  onClose?: () => void
}

export default function DeliveryViewer({ riftId, delivery, onClose }: DeliveryViewerProps) {
  const { showToast } = useToast()
  const [viewerSessionId, setViewerSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [secondsViewed, setSecondsViewed] = useState(0)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const lastPingTimeRef = useRef<number>(Date.now())

  // Initialize viewer session
  useEffect(() => {
    const initViewer = async () => {
      try {
        const response = await fetch(`/api/rifts/${riftId}/delivery/viewer`, {
          method: 'POST',
        })

        if (!response.ok) {
          const error = await response.json()
          showToast(error.error || 'Failed to open delivery viewer', 'error')
          onClose?.()
          return
        }

        const data = await response.json()
        setViewerSessionId(data.viewerSessionId)
        setLoading(false)
      } catch (error: any) {
        console.error('Init viewer error:', error)
        showToast('Failed to open delivery viewer', 'error')
        onClose?.()
      }
    }

    initViewer()

    // Cleanup on unmount
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [riftId, onClose, showToast])

  // Ping server every 10 seconds to update engagement time
  useEffect(() => {
    if (!viewerSessionId) return

    pingIntervalRef.current = setInterval(async () => {
      const now = Date.now()
      const secondsSinceLastPing = Math.floor((now - lastPingTimeRef.current) / 1000)
      
      if (secondsSinceLastPing > 0) {
        try {
          await fetch(`/api/rifts/${riftId}/delivery/viewer`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              viewerSessionId,
              secondsIncrement: secondsSinceLastPing,
            }),
          })

          setSecondsViewed(prev => prev + secondsSinceLastPing)
          lastPingTimeRef.current = now
        } catch (error) {
          console.error('Ping error:', error)
        }
      }
    }, 10000) // Every 10 seconds

    // Send final ping on unmount
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }

      // Final ping
      const finalSeconds = Math.floor((Date.now() - lastPingTimeRef.current) / 1000)
      if (finalSeconds > 0 && viewerSessionId) {
        fetch(`/api/rifts/${riftId}/delivery/viewer`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewerSessionId,
            secondsIncrement: finalSeconds,
          }),
        }).catch(console.error)
      }
    }
  }, [riftId, viewerSessionId])

  const handleDownload = async () => {
    if (!viewerSessionId) return

    setDownloading(true)
    try {
      const response = await fetch(
        `/api/rifts/${riftId}/delivery/download?viewerSessionId=${viewerSessionId}`
      )

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error || 'Failed to generate download link', 'error')
        return
      }

      const data = await response.json()
      
      // Open download in new tab
      window.open(data.downloadUrl, '_blank')
      
      showToast('Download started', 'success')
    } catch (error: any) {
      console.error('Download error:', error)
      showToast('Failed to download file', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-white/60 font-light">Opening delivery viewer...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-light text-white">Digital Delivery</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90 font-medium">{delivery.fileName}</span>
            <span className="text-white/50 text-sm">{formatFileSize(delivery.sizeBytes)}</span>
          </div>
          <div className="text-white/60 text-sm">{delivery.mimeType}</div>
        </div>

        <div className="flex gap-3">
          <PremiumButton
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1"
            glow
          >
            {downloading ? 'Preparing download...' : 'Download File'}
          </PremiumButton>
        </div>

        <div className="text-xs text-white/40 font-light">
          Time viewed: {Math.floor(secondsViewed / 60)}m {secondsViewed % 60}s
        </div>
      </div>
    </div>
  )
}

