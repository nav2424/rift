'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // First, validate credentials by attempting sign-in
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        // Sign-in failed - check if it's due to verification requirements
        // We'll check verification status to provide helpful error messages
        try {
          const verificationResponse = await fetch('/api/auth/check-verification-by-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          })

          if (verificationResponse.ok) {
            const verificationData = await verificationResponse.json()
            
            // Only show verification errors if we can confirm the account exists
            // and credentials might be correct (NextAuth returns null for both wrong password and unverified)
            if (!verificationData.allVerified) {
              if (!verificationData.emailVerified && !verificationData.phoneVerified) {
                setError('Email and phone not verified. Please verify both to access the platform.')
                setLoading(false)
                return
              } else if (!verificationData.emailVerified) {
                setError('Email not verified. Please verify your email address to access the platform.')
                setLoading(false)
                return
              } else if (!verificationData.phoneVerified) {
                setError('Phone not verified. Please verify your phone number to access the platform.')
                setLoading(false)
                return
              }
            }
          }
        } catch (verificationError) {
          console.error('Error checking verification:', verificationError)
          // Fall through to generic error if verification check fails
        }

        // Default to generic error message for security (don't reveal if account exists)
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      // Redirect on success
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
      router.push(callbackUrl)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const registered = searchParams?.get('registered')
  const passwordReset = searchParams?.get('passwordReset')

  return (
    <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-medium text-white mb-4 tracking-tight">
            Sign in
          </h1>
          <p className="text-white/50 font-light text-base">
            Enter your credentials to access your account
          </p>
        </div>

        {/* Form Card */}
        <GlassCard className="p-8 lg:p-10 glass-highlight">
          {registered && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-emerald-400 text-sm font-light">Account created successfully! Please sign in.</p>
              </div>
            </div>
          )}

          {passwordReset && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-emerald-400 text-sm font-light">Password reset successfully! Please sign in with your new password.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm font-light">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3.5 bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm font-light hover:bg-white/[0.07] hover:border-white/15"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3.5 bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm font-light hover:bg-white/[0.07] hover:border-white/15"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Link 
                href="/auth/forgot-password" 
                className="text-white/50 hover:text-emerald-400/60 text-sm font-light transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <PremiumButton type="submit" className="w-full mt-6" variant="primary" disabled={loading} glow>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </PremiumButton>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-white/50 text-sm font-light">
              Don't have an account?{' '}
              <Link 
                href="/auth/signup" 
                className="text-emerald-400/70 hover:text-emerald-400 font-medium transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
