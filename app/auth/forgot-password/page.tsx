'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send password reset email')
        return
      }

      setSuccess(true)
    } catch (error: any) {
      console.error('Forgot password error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center px-4">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-gray-50 rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-gray-50 rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <GlassCard variant="liquid" className="max-w-md w-full p-8 relative z-10">
        <h1 className="text-4xl font-light text-[#1d1d1f] mb-6 text-center tracking-tight">Forgot Password</h1>
        
        {success ? (
          <div className="space-y-4">
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-700 text-sm font-light">
                If an account with that email exists, we've sent you a password reset link. Please check your email and follow the instructions to reset your password.
              </p>
            </div>
            <Link href="/auth/signin">
              <PremiumButton className="w-full">
                Back to Sign In
              </PremiumButton>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[#86868b] text-sm font-light mb-6 text-center">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                <p className="text-gray-700 text-sm font-light">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-light text-gray-600 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all font-light"
                  placeholder="you@example.com"
                />
              </div>
              <PremiumButton type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </PremiumButton>
            </form>

            <p className="mt-6 text-center text-[#86868b] text-sm font-light">
              Remember your password?{' '}
              <Link href="/auth/signin" className="text-gray-700 hover:text-[#1d1d1f] transition-colors underline underline-offset-2">
                Sign In
              </Link>
            </p>
          </>
        )}
      </GlassCard>
    </div>
  )
}
