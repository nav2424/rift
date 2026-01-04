'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

export default function EditProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      // Fetch full profile including phone
      fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(data => {
          const userData = data.user || data.User || data
          if (userData) {
            setName(userData.name || '')
            setPhone(userData.phone || '')
          } else {
            setName(session?.user?.name || '')
          }
        })
        .catch(() => {
          setName(session?.user?.name || '')
        })
    }
  }, [session, status, router])

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return ''
    
    // If phone is already in E.164 format (+1234567890), format it nicely
    const cleaned = phone.replace(/^\+/, '')
    
    // US/Canada format: (123) 456-7890
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const areaCode = cleaned.slice(1, 4)
      const exchange = cleaned.slice(4, 7)
      const number = cleaned.slice(7, 11)
      return `+1 (${areaCode}) ${exchange}-${number}`
    }
    
    // US/Canada without country code: (123) 456-7890
    if (cleaned.length === 10) {
      const areaCode = cleaned.slice(0, 3)
      const exchange = cleaned.slice(3, 6)
      const number = cleaned.slice(6, 10)
      return `(${areaCode}) ${exchange}-${number}`
    }
    
    // Return original if format is unknown
    return phone
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim() || null,
          // Phone cannot be changed here
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      const data = await response.json()
      // API returns { user: {...} } (lowercase 'user')
      const userData = data.user
      
      if (!userData) {
        throw new Error('Invalid response from server')
      }
      
      // Update the session - this will trigger the JWT callback with trigger='update'
      // NextAuth will automatically refresh all components using useSession
      await updateSession({
        name: userData.name || null,
      })

      router.push('/account')
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
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
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 flex-shrink-0 mt-1">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-light text-white mb-2 tracking-tight">
                  Edit Profile
                </h1>
                <p className="text-white/60 font-light">Update your personal information</p>
              </div>
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
          <div className="p-6">
            <form onSubmit={handleSave} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-white/60 font-light mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-white/60 font-light mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formatPhoneNumber(phone) || ''}
                  readOnly
                  disabled
                  placeholder="No phone number set"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-light cursor-not-allowed"
                />
                <p className="mt-2 text-white/40 text-sm font-light">Phone number cannot be changed here. Use the verification page to update your phone number.</p>
              </div>

              <div>
                <label className="block text-white/60 font-light mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </label>
                <input
                  type="email"
                  value={session?.user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-light cursor-not-allowed"
                />
                <p className="mt-2 text-white/40 text-sm font-light">Email cannot be changed</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 border border-white/20 hover:border-white/30 text-white font-light"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
