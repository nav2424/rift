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
                return
              } else if (!verificationData.emailVerified) {
                setError('Email not verified. Please verify your email address to access the platform.')
                return
              } else if (!verificationData.phoneVerified) {
                setError('Phone not verified. Please verify your phone number to access the platform.')
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
        return
      }

      router.push('/dashboard')
    } catch (error) {
      console.error('Signin error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const registered = searchParams?.get('registered')
  const passwordReset = searchParams?.get('passwordReset')

  return (
    <div className="min-h-screen relative overflow-hidden bg-black flex items-start justify-center px-4 pt-8 sm:pt-12">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <GlassCard variant="liquid" className="max-w-md w-full p-8 relative z-10 mt-8 sm:mt-12">
        <h1 className="text-4xl font-light text-white mb-6 text-center tracking-tight">Sign In</h1>
        
        {registered && (
          <div className="bg-white/[0.08] border border-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
            <p className="text-white/80 text-sm font-light">Account created successfully! Please sign in.</p>
          </div>
        )}

        {passwordReset && (
          <div className="bg-white/[0.08] border border-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
            <p className="text-white/80 text-sm font-light">Password reset successfully! Please sign in with your new password.</p>
          </div>
        )}

        {error && (
          <div className="bg-white/[0.08] border border-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
            <p className="text-white/80 text-sm font-light">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
              placeholder="••••••••"
            />
          </div>
          <PremiumButton type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </PremiumButton>
        </form>

        <div className="mt-4 text-center">
          <Link 
            href="/auth/forgot-password" 
            className="text-white/60 hover:text-white/80 text-sm font-light underline underline-offset-2 transition-colors"
          >
            Forgot Password?
          </Link>
        </div>

        <p className="mt-6 text-center text-white/60 text-sm font-light">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-white/80 hover:text-white transition-colors underline underline-offset-2">
            Sign Up
          </Link>
        </p>
      </GlassCard>
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

