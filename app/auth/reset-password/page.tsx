'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)

  useEffect(() => {
    const tokenParam = searchParams?.get('token')
    if (tokenParam) {
      setToken(tokenParam)
      // Validate token
      validateToken(tokenParam)
    } else {
      setValidating(false)
      setError('Reset token is missing. Please use the link from your email.')
    }
  }, [searchParams])

  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await fetch(`/api/auth/reset-password/validate?token=${tokenToValidate}`, {
        method: 'GET',
      })

      if (response.ok) {
        const text = await response.text()
        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text)
            if (data.valid) {
              setTokenValid(true)
            } else {
              setError(data.error || 'Invalid or expired reset token')
            }
          } catch (parseError) {
            // If parsing fails but status is OK, assume valid
            setTokenValid(true)
          }
        } else {
          // Empty response but OK status, assume valid
          setTokenValid(true)
        }
      } else {
        const text = await response.text()
        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text)
            setError(data.error || 'Invalid or expired reset token')
          } catch (parseError) {
            setError('Invalid or expired reset token')
          }
        } else {
          setError('Invalid or expired reset token')
        }
      }
    } catch (error) {
      console.error('Token validation error:', error)
      setError('Failed to validate reset token')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const text = await response.text()
      let data: any = {}
      
      if (text && text.trim().length > 0) {
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          console.error('Failed to parse reset password response:', parseError)
          if (!response.ok) {
            setError('Failed to reset password')
            return
          }
        }
      }

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
        return
      }

      setSuccess(true)
      // Redirect to sign in after 3 seconds
      setTimeout(() => {
        router.push('/auth/signin?passwordReset=true')
      }, 3000)
    } catch (error: any) {
      console.error('Reset password error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center px-4">
        <GlassCard variant="liquid" className="max-w-md w-full p-8 relative z-10">
          <div className="text-center">
            <div className="text-white/60 font-light">Validating reset token...</div>
          </div>
        </GlassCard>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center px-4">
        {/* Subtle grid background */}
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
        
        {/* Minimal floating elements */}
        <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
        <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

        <GlassCard variant="liquid" className="max-w-md w-full p-8 relative z-10">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-4xl font-light text-white mb-2 tracking-tight">Password Reset</h1>
            <p className="text-white/80 text-sm font-light">
              Your password has been successfully reset. Redirecting to sign in...
            </p>
            <Link href="/auth/signin">
              <PremiumButton className="w-full mt-6">
                Go to Sign In
              </PremiumButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center px-4">
        {/* Subtle grid background */}
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
        
        {/* Minimal floating elements */}
        <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
        <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

        <GlassCard variant="liquid" className="max-w-md w-full p-8 relative z-10">
          <h1 className="text-4xl font-light text-white mb-6 text-center tracking-tight">Invalid Token</h1>
          
          {error && (
            <div className="bg-white/[0.08] border border-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm font-light">{error}</p>
            </div>
          )}

          <p className="text-white/60 text-sm font-light mb-6 text-center">
            This password reset link is invalid or has expired. Please request a new one.
          </p>

          <Link href="/auth/forgot-password">
            <PremiumButton className="w-full">
              Request New Reset Link
            </PremiumButton>
          </Link>

          <p className="mt-6 text-center text-white/60 text-sm font-light">
            <Link href="/auth/signin" className="text-white/80 hover:text-white transition-colors underline underline-offset-2">
              Back to Sign In
            </Link>
          </p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center px-4">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <GlassCard variant="liquid" className="max-w-md w-full p-8 relative z-10">
        <h1 className="text-4xl font-light text-white mb-6 text-center tracking-tight">Reset Password</h1>
        
        <p className="text-white/60 text-sm font-light mb-6 text-center">
          Enter your new password below.
        </p>

        {error && (
          <div className="bg-white/[0.08] border border-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
            <p className="text-white/80 text-sm font-light">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-white/40 font-light">Must be at least 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
              placeholder="••••••••"
            />
          </div>
          <PremiumButton type="submit" className="w-full" disabled={loading}>
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </PremiumButton>
        </form>

        <p className="mt-6 text-center text-white/60 text-sm font-light">
          <Link href="/auth/signin" className="text-white/80 hover:text-white transition-colors underline underline-offset-2">
            Back to Sign In
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

