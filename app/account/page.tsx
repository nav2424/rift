'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { useToast } from '@/components/ui/Toast'

interface Dispute {
  id: string
  status: string
  reason: string
  rift: {
    id: string
    itemTitle: string
    status: string
    amount: number
    currency: string
  }
  createdAt: string
}

interface UserProfile {
  name: string | null
  email: string
  phone: string | null
  riftUserId?: string | null
  emailVerified?: boolean
  phoneVerified?: boolean
}

interface RiftTransaction {
  id: string
  amount: number
  currency: string
  status: string
  buyerId: string
  sellerId: string
  subtotal?: number
}

export default function AccountPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [rifts, setRifts] = useState<RiftTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadDisputes()
      loadProfile()
      loadRifts()
    }
  }, [status, router, session])

  const loadDisputes = async () => {
    try {
      const response = await fetch('/api/me/disputes', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setDisputes(data.disputes || [])
      }
    } catch (error) {
      console.error('Error loading disputes:', error)
      // Silent failure for disputes - not critical
    }
  }

  const loadProfile = async () => {
    try {
      // Try to fetch full profile from API (includes phone)
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        // Handle both { user: {...} } and direct user object formats
        const userData = data.user || data
        
        // If Rift ID is missing, try multiple times to get it (ensureRiftUserId might need time)
        let riftUserId = userData.riftUserId || null
        if (!riftUserId) {
          // Retry up to 3 times with increasing delays
          for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt))
            const retryResponse = await fetch('/api/auth/me', {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            })
            if (retryResponse.ok) {
              const retryData = await retryResponse.json()
              const retryUserData = retryData.user || retryData
              if (retryUserData.riftUserId) {
                riftUserId = retryUserData.riftUserId
                break
              }
            }
          }
        }
        
        setProfile({
          name: userData.name || null,
          email: userData.email || '',
          phone: userData.phone || null,
          riftUserId: riftUserId,
          // If user is logged in, they should be verified (required to access platform)
          // But show actual status from database
          emailVerified: userData.emailVerified ?? true,
          phoneVerified: userData.phoneVerified ?? true,
        })
      } else {
        // Fallback to session data if API fails
        setProfile({
          name: session?.user?.name || null,
          email: session?.user?.email || '',
          phone: null,
          riftUserId: null,
          emailVerified: true, // Assume verified if logged in
          phoneVerified: true, // Assume verified if logged in
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      showToast('Failed to load profile. Some information may be missing.', 'warning')
      // Fallback to session data on error
      setProfile({
        name: session?.user?.name || null,
        email: session?.user?.email || '',
        phone: null,
        riftUserId: null,
        emailVerified: true, // Assume verified if logged in
        phoneVerified: true, // Assume verified if logged in
      })
    } finally {
      setLoading(false)
    }
  }

  const loadRifts = async () => {
    try {
      const response = await fetch('/api/rifts/list?limit=50', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setRifts(data.data || data.rifts || [])
      }
    } catch (error) {
      console.error('Error loading rifts:', error)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const metrics = useMemo(() => {
    // Exclude cancelled rifts from all metrics
    const validEscrows = rifts.filter(e => e.status !== 'CANCELLED')
    
    const active = validEscrows.filter(e => 
      ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'].includes(e.status)
    )
    const completed = validEscrows.filter(e => ['RELEASED', 'PAID_OUT'].includes(e.status))
    
    // Total value = active + completed (excludes cancelled)
    // Use subtotal if available, otherwise fall back to amount
    const totalValue = active.reduce((sum, e) => sum + (e.subtotal || e.amount || 0), 0) + 
                      completed.reduce((sum, e) => sum + (e.subtotal || e.amount || 0), 0)
    const activeValue = active.reduce((sum, e) => sum + (e.subtotal || e.amount || 0), 0)
    const completedValue = completed.reduce((sum, e) => sum + (e.subtotal || e.amount || 0), 0)
    
    return {
      totalValue,
      activeValue,
      completedValue,
      activeCount: active.length,
      completedCount: completed.length,
      totalTransactions: validEscrows.length,
    }
  }, [rifts])

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut({ callbackUrl: '/' })
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

  const activeDisputes = disputes.filter(d => d.status === 'OPEN')
  const userProfile = profile || {
    name: session?.user?.name || null,
    email: session?.user?.email || '',
    phone: null,
    riftUserId: null,
    emailVerified: false,
    phoneVerified: false,
  }

  const handleCopyRiftId = async () => {
    if (!userProfile.riftUserId) {
      showToast('Rift ID not available', 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(userProfile.riftUserId)
      showToast(`Rift ID ${userProfile.riftUserId} copied to clipboard!`, 'success')
    } catch (error) {
      showToast('Failed to copy Rift ID', 'error')
    }
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
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-light text-white mb-3 tracking-tight">
            Account
          </h1>
          <p className="text-white/60 font-light">Profile & support</p>
        </div>

        {/* Transaction Summary */}
        {metrics.totalValue > 0 && (
          <GlassCard className="mb-6 hover:border-white/20 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                  <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-light text-white">Transaction Summary</h2>
                  <p className="text-white/40 font-light text-sm">Total of active and completed transactions</p>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-3xl font-light text-white tracking-tight mb-2">
                  {formatCurrency(metrics.totalValue, 'USD')}
                </p>
                <p className="text-sm text-white/50 font-light">
                  {metrics.totalTransactions} total transaction{metrics.totalTransactions !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-sm text-white/50 font-light mb-1">In Rifts</p>
                  <p className="text-lg font-light text-white">
                    {formatCurrency(metrics.activeValue, 'USD')}
                  </p>
                  <p className="text-xs text-white/40 font-light mt-1">
                    {metrics.activeCount} active
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/50 font-light mb-1">Settled</p>
                  <p className="text-lg font-light text-white">
                    {formatCurrency(metrics.completedValue, 'USD')}
                  </p>
                  <p className="text-xs text-white/40 font-light mt-1">
                    {metrics.completedCount} completed
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Profile Card */}
        <GlassCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-light text-white">Profile</h2>
                <p className="text-white/40 font-light text-sm">Manage your account information</p>
              </div>
            </div>
            
            <div className="space-y-1 mb-6">
              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-white/60 font-light">Name</span>
                </div>
                <span className="text-white font-light">{userProfile.name || 'Not set'}</span>
              </div>
              
              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/60 font-light">Email</span>
                </div>
                <span className="text-white font-light">{userProfile.email}</span>
              </div>
              
              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-white/60 font-light">Phone</span>
                </div>
                <span className="text-white font-light">{userProfile.phone || 'Not set'}</span>
              </div>
              
              <div className="flex justify-between items-center py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span className="text-white/60 font-light">Rift ID</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white font-light tracking-wider">{userProfile.riftUserId || 'Not assigned'}</span>
                  {userProfile.riftUserId && (
                    <button
                      onClick={handleCopyRiftId}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all duration-200 group"
                      title="Copy Rift ID"
                    >
                      <svg className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-white/70 group-hover:text-white text-xs font-light">Copy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <Link 
              href="/account/edit-profile"
              className="block w-full text-center py-3 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/20 text-white font-light hover:border-white/30"
            >
              Edit Profile
            </Link>
          </div>
        </GlassCard>

        {/* Verification Status Card */}
        <GlassCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center border border-green-500/20">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-light text-white">Verification Status</h2>
                <p className="text-white/40 font-light text-sm">Phone verification required for withdrawals</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-white/70 font-light">Email Verified</span>
                <span className="text-green-400">
                  ✓ Verified
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-white/70 font-light">Phone Verified</span>
                <span className="text-green-400">
                  ✓ Verified
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Disputes Card */}
        <GlassCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-light text-white">Your Disputes</h2>
                <p className="text-white/40 font-light text-sm">View and manage disputes</p>
              </div>
            </div>
            
            <Link 
              href="/account/disputes"
              className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/10 group"
            >
              <div>
                <p className="text-white font-light mb-1">View any active or resolved disputes</p>
                {activeDisputes.length > 0 && (
                  <p className="text-yellow-400 text-sm font-light flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    {activeDisputes.length} active
                  </p>
                )}
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </GlassCard>

        {/* Support & Help Center */}
        <GlassCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-light text-white">Support & Help Center</h2>
                <p className="text-white/40 font-light text-sm">Get help and answers</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Link 
                href="/account/support?type=contact"
                className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/10 group"
              >
                <span className="text-white font-light">Contact Support</span>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              
              <Link 
                href="/account/support?type=report"
                className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/10 group"
              >
                <span className="text-white font-light">Report a problem</span>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </GlassCard>

        {/* Admin Section */}
        {session?.user?.role === 'ADMIN' && (
          <GlassCard className="mb-6 border-purple-500/20">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-light text-white">Admin</h2>
                  <p className="text-white/40 font-light text-sm">Administrative tools</p>
                </div>
              </div>
              
              <Link 
                href="/admin"
                className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/10 group"
              >
                <span className="text-purple-400 font-light">Admin Dashboard</span>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </GlassCard>
        )}

        {/* Delete Account */}
        <GlassCard className="mb-6 border-red-500/20">
          <div className="p-6">
            <h3 className="text-lg font-light text-white mb-2">Danger Zone</h3>
            <p className="text-white/60 font-light text-sm mb-4">
              Permanently delete your account and all associated data
            </p>
            <Link
              href="/account/delete"
              className="inline-block px-6 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/20 transition-all duration-200 border border-red-500/30 hover:border-red-500/40 text-red-400 font-light"
            >
              Delete Account
            </Link>
          </div>
        </GlassCard>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full py-4 px-6 rounded-xl bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/20 hover:border-white/30 text-white font-light"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
