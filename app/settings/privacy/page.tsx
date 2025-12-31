'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { useToast } from '@/components/ui/Toast'

export default function PrivacySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInActivityFeed, setShowInActivityFeed] = useState(true)
  const [showAmountsInFeed, setShowAmountsInFeed] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadPreferences()
    }
  }, [status, router])

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setShowInActivityFeed(data.showInActivityFeed ?? true)
        setShowAmountsInFeed(data.showAmountsInFeed ?? true)
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      showToast('Failed to load privacy settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          showInActivityFeed,
          showAmountsInFeed,
        }),
      })

      if (response.ok) {
        showToast('Privacy settings saved successfully', 'success')
      } else {
        const error = await response.json().catch(() => ({}))
        showToast(error.error || 'Failed to save privacy settings', 'error')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      showToast('Failed to save privacy settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-light text-white mb-2 tracking-tight">
                Privacy Settings
              </h1>
              <p className="text-white/60 font-light">Control how your activity appears in the feed</p>
            </div>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Account
            </Link>
          </div>
        </div>

        <GlassCard>
          <div className="p-6 space-y-6">
            {/* Show in Activity Feed */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-light text-lg mb-2">Show in Activity Feed</h3>
                <p className="text-white/60 font-light text-sm">
                  When enabled, your completed transactions will appear in the public activity feed
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInActivityFeed}
                  onChange={(e) => setShowInActivityFeed(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500/30 border border-white/20"></div>
              </label>
            </div>

            <div className="h-px bg-white/10" />

            {/* Show Amounts in Feed */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-light text-lg mb-2">Show Amounts in Feed</h3>
                <p className="text-white/60 font-light text-sm">
                  When enabled, transaction amounts will be visible in the activity feed. Disable to keep amounts private.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAmountsInFeed}
                  onChange={(e) => setShowAmountsInFeed(e.target.checked)}
                  disabled={!showInActivityFeed}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500/30 border border-white/20 ${!showInActivityFeed ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="p-6 pt-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors border border-white/20 text-white font-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

