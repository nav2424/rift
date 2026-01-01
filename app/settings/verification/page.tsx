'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

export default function VerificationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phone, setPhone] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingPhone, setSendingPhone] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && session) {
      fetchUser()
    }
  }, [status, session, router])

  const fetchUser = async () => {
    try {
      // Try web session endpoint first
      let response = await fetch('/api/me', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        // Fallback to mobile auth endpoint
        response = await fetch('/api/auth/me', {
          credentials: 'include',
        })
      }
      
      if (response.ok) {
        const data = await response.json()
        // Handle both { user: {...} } and direct user object formats
        const userData = data.user || data
        setUser(userData)
        setPhone(userData.phone || '')
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendEmailCode = async () => {
    setSendingEmail(true)
    setMessage(null)
    try {
      const response = await fetch('/api/verify/email/send', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok) {
        if (data.code) {
          // Code returned (SMTP not configured or dev mode)
          setMessage({ 
            type: 'success', 
            text: `Verification code: ${data.code} (SMTP not configured - code shown here)` 
          })
          // Auto-fill the code for convenience
          setEmailCode(data.code)
        } else {
          setMessage({ type: 'success', text: data.message || 'Verification code sent to your email' })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send verification code' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send verification code' })
    } finally {
      setSendingEmail(false)
    }
  }

  const verifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter a 6-digit code' })
      return
    }

    setVerifyingEmail(true)
    setMessage(null)
    try {
      const response = await fetch('/api/verify/email/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: emailCode }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Email verified successfully!' })
        setEmailCode('')
        await fetchUser() // Refresh user data
      } else {
        setMessage({ type: 'error', text: data.error || 'Invalid verification code' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify email' })
    } finally {
      setVerifyingEmail(false)
    }
  }

  const sendPhoneCode = async () => {
    if (!phone || phone.trim().length === 0) {
      setMessage({ type: 'error', text: 'Please enter your phone number' })
      return
    }

    setSendingPhone(true)
    setMessage(null)
    try {
      const response = await fetch('/api/verify/phone/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Verification code sent to your phone' })
        if (data.code) {
          // In development, show the code
          setMessage({ type: 'success', text: `Code sent! (Dev: ${data.code})` })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send verification code' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send verification code' })
    } finally {
      setSendingPhone(false)
    }
  }

  const verifyPhone = async () => {
    if (!phoneCode || phoneCode.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter a 6-digit code' })
      return
    }

    setVerifyingPhone(true)
    setMessage(null)
    try {
      const response = await fetch('/api/verify/phone/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: phoneCode }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Phone number verified successfully!' })
        setPhoneCode('')
        await fetchUser() // Refresh user data
      } else {
        setMessage({ type: 'error', text: data.error || 'Invalid verification code' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify phone' })
    } finally {
      setVerifyingPhone(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none" 
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} 
      />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-light text-white mb-4 tracking-tight">
            Verify Your Account
          </h1>
          <p className="text-white/60 font-light">
            Verify your email and phone number to enable withdrawals
          </p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <p className="font-light">{message.text}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Email Verification */}
          <GlassCard>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-light text-white mb-2">Email Verification</h2>
                  <p className="text-sm text-white/60 font-light">
                    {user.email}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg text-sm font-light ${
                  user.emailVerified
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {user.emailVerified ? 'Verified' : 'Not Verified'}
                </div>
              </div>

              {!user.emailVerified ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/50 font-light mb-2">
                      Enter Verification Code
                    </label>
                    <input
                      type="text"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 font-light focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/40 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <PremiumButton
                      onClick={sendEmailCode}
                      disabled={sendingEmail}
                      variant="outline"
                      className="flex-1"
                    >
                      {sendingEmail ? 'Sending...' : 'Send Code'}
                    </PremiumButton>
                    <PremiumButton
                      onClick={verifyEmail}
                      disabled={verifyingEmail || emailCode.length !== 6}
                      className="flex-1"
                      glow
                    >
                      {verifyingEmail ? 'Verifying...' : 'Verify Email'}
                    </PremiumButton>
                  </div>
                </div>
              ) : (
                <p className="text-green-400 text-sm font-light">✓ Your email is verified</p>
              )}
            </div>
          </GlassCard>

          {/* Phone Verification */}
          <GlassCard>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-light text-white mb-2">Phone Verification</h2>
                  <p className="text-sm text-white/60 font-light">
                    {user.phone || 'No phone number set'}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg text-sm font-light ${
                  user.phoneVerified
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {user.phoneVerified ? 'Verified' : 'Not Verified'}
                </div>
              </div>

              {!user.phoneVerified ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/50 font-light mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 font-light focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/50 font-light mb-2">
                      Enter Verification Code
                    </label>
                    <input
                      type="text"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 font-light focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/40 transition-all"
                    />
                  </div>
                  <div className="flex gap-3">
                    <PremiumButton
                      onClick={sendPhoneCode}
                      disabled={sendingPhone || !phone.trim()}
                      variant="outline"
                      className="flex-1"
                    >
                      {sendingPhone ? 'Sending...' : 'Send Code'}
                    </PremiumButton>
                    <PremiumButton
                      onClick={verifyPhone}
                      disabled={verifyingPhone || phoneCode.length !== 6}
                      className="flex-1"
                      glow
                    >
                      {verifyingPhone ? 'Verifying...' : 'Verify Phone'}
                    </PremiumButton>
                  </div>
                </div>
              ) : (
                <p className="text-green-400 text-sm font-light">✓ Your phone number is verified</p>
              )}
            </div>
          </GlassCard>

          {/* Withdrawal Requirements */}
          <GlassCard>
            <div className="p-6">
              <h2 className="text-xl font-light text-white mb-4">Withdrawal Requirements</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 font-light">Email Verified</span>
                  <span className={user.emailVerified ? 'text-green-400' : 'text-yellow-400'}>
                    {user.emailVerified ? '✓' : '⚠ Optional (required for mobile)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70 font-light">Phone Verified</span>
                  <span className={user.phoneVerified ? 'text-green-400' : 'text-red-400'}>
                    {user.phoneVerified ? '✓' : '✗ Required'}
                  </span>
                </div>
                <div className="pt-3 border-t border-white/10">
                  {user.phoneVerified ? (
                    <p className="text-green-400 text-sm font-light">
                      ✓ Phone verified. You can withdraw funds on web. (Email verification required for mobile withdrawals)
                    </p>
                  ) : (
                    <p className="text-yellow-400 text-sm font-light">
                      Please verify your phone number to enable withdrawals.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
