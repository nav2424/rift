'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'
import DatePicker from '@/components/ui/DatePicker'
import { validatePassword } from '@/lib/password-validation'

type SignupStep = 'personal-info' | 'verify-email' | 'verify-phone' | 'password'

export default function SignUp() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<SignupStep>('personal-info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Load sessionId from localStorage on mount
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('signupSessionId')
    }
    return null
  })
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthday: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  })
  const [emailCode, setEmailCode] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [devEmailCode, setDevEmailCode] = useState<string | null>(null)
  const [devPhoneCode, setDevPhoneCode] = useState<string | null>(null)
  const [resendEmailCooldown, setResendEmailCooldown] = useState(0)
  const [resendPhoneCooldown, setResendPhoneCooldown] = useState(0)
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)

  const totalSteps = 4
  const currentStepNumber = 
    currentStep === 'personal-info' ? 1 :
    currentStep === 'verify-email' ? 2 :
    currentStep === 'verify-phone' ? 3 : 4
  const progress = (currentStepNumber / totalSteps) * 100

  // Cooldown timers
  useEffect(() => {
    if (resendEmailCooldown > 0) {
      const timer = setTimeout(() => setResendEmailCooldown(resendEmailCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendEmailCooldown])

  useEffect(() => {
    if (resendPhoneCooldown > 0) {
      const timer = setTimeout(() => setResendPhoneCooldown(resendPhoneCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendPhoneCooldown])

  // Step 1: Personal Info (firstName, lastName, birthday)
  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.firstName.trim()) {
      setError('First name is required')
      return
    }

    if (!formData.lastName.trim()) {
      setError('Last name is required')
      return
    }

    if (!formData.birthday) {
      setError('Birthday is required')
      return
    }

    // Validate birthday (must be at least 13 years old)
    const birthDate = new Date(formData.birthday)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    if (age < 13) {
      setError('You must be at least 13 years old to sign up')
      return
    }

    // Move to email step
    setCurrentStep('verify-email')
  }

  // Step 2: Email and Email Verification
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.email) {
      setError('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      // Create account with temporary password (will be updated later)
      const response = await fetch('/api/auth/create-signup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          birthday: formData.birthday,
          email: formData.email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        return
      }

      setSessionId(data.sessionId)
      // Persist sessionId to localStorage
      if (typeof window !== 'undefined' && data.sessionId) {
        localStorage.setItem('signupSessionId', data.sessionId)
      }
      setEmail(formData.email)
      setEmailCodeSent(true)
      
      // Store code in development mode (only if email failed to send)
      if (data.emailCode) {
        setDevEmailCode(data.emailCode)
        console.warn('⚠️ Email not sent. Using dev code for testing:', data.emailCode)
        setError('Email not sent (SMTP not configured). Check console for verification code.')
      } else if (!data.emailSent) {
        setError('Failed to send verification email. Please check your email configuration.')
      }
    } catch (error: any) {
      console.error('Create account error:', error)
      setError(error?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!emailCode || emailCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code')
      return
    }

    if (!sessionId) {
      setError('Signup session is missing. Please start over.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code: emailCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid verification code')
        return
      }

      // Move to phone step
      setCurrentStep('verify-phone')
      setEmailCode('')
    } catch (error: any) {
      console.error('Email verification error:', error)
      setError(error?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Phone and Phone Verification
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.phone.trim()) {
      setError('Phone number is required')
      return
    }

    if (!sessionId) {
      setError('Signup session is missing. Please start over.')
      return
    }

    setLoading(true)

    try {
      // Update phone number and send verification code
      const response = await fetch('/api/auth/update-signup-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phone: formData.phone }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update phone number')
        return
      }

      setPhone(formData.phone)
      setPhoneCodeSent(true)
      
      // Store code in development mode (only if SMS failed to send)
      if (data.phoneCode) {
        setDevPhoneCode(data.phoneCode)
        console.warn('⚠️ SMS not sent. Using dev code for testing:', data.phoneCode)
        setError('SMS not sent (Twilio not configured). Check console for verification code.')
      } else if (!data.smsSent) {
        setError('Failed to send verification SMS. Please check your Twilio configuration.')
      }
    } catch (error: any) {
      console.error('Phone submit error:', error)
      setError(error?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!phoneCode || phoneCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code')
      return
    }

    if (!sessionId) {
      setError('Signup session is missing. Please start over.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-phone-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code: phoneCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid verification code')
        return
      }

      // Move to password step
      setCurrentStep('password')
      setPhoneCode('')
    } catch (error: any) {
      console.error('Phone verification error:', error)
      setError(error?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 4: Password and Finalize
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.password) {
      setError('Password is required')
      return
    }

    // Validate password requirements
    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0] || 'Password does not meet requirements')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!sessionId) {
      setError('Signup session is missing. Please start over.')
      return
    }

    setLoading(true)

    try {
      // Finalize account with real password
      const response = await fetch('/api/auth/finalize-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, password: formData.password, confirmPassword: formData.confirmPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to finalize account')
        return
      }

      // All done! Automatically sign the user in and redirect to dashboard
      try {
        const signInResult = await signIn('credentials', {
          email: formData.email || email,
          password: formData.password,
          redirect: false,
        })

        if (signInResult?.error) {
          // If auto sign-in fails, redirect to sign-in page
          console.error('Auto sign-in failed:', signInResult.error)
          router.push('/auth/signin?registered=true')
          return
        }

        // Successfully signed in, clear localStorage and redirect to dashboard
        if (typeof window !== 'undefined') {
          localStorage.removeItem('signupSessionId')
        }
        router.push('/dashboard')
      } catch (signInError) {
        console.error('Auto sign-in error:', signInError)
        // If auto sign-in fails, redirect to sign-in page
        router.push('/auth/signin?registered=true')
      }
    } catch (error: any) {
      console.error('Finalize signup error:', error)
      setError(error?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmailCode = async () => {
    if (resendEmailCooldown > 0 || !sessionId) return

    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/resend-email-code-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to resend verification code')
        return
      }

      // Store code in development mode (only if email failed to send)
      if (data.emailCode) {
        setDevEmailCode(data.emailCode)
        console.warn('⚠️ Email not sent. Using dev code for testing:', data.emailCode)
      }
      
      setResendEmailCooldown(60)
      setError('') // Clear any previous errors
    } catch (error) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendPhoneCode = async () => {
    if (resendPhoneCooldown > 0 || !sessionId) return

    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/resend-phone-code-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to resend verification code')
        return
      }

      // Store code in development mode (only if SMS failed to send)
      if (data.phoneCode) {
        setDevPhoneCode(data.phoneCode)
        console.warn('⚠️ SMS not sent. Using dev code for testing:', data.phoneCode)
      }
      
      setResendPhoneCooldown(60)
      setError('') // Clear any previous errors
    } catch (error) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
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
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-light text-white/50">Step {currentStepNumber} of {totalSteps}</span>
            <span className="text-xs font-light text-white/50">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/20 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <h1 className="text-4xl font-light text-white mb-6 text-center tracking-tight">
          {currentStep === 'personal-info' && 'Personal Information'}
          {currentStep === 'verify-email' && 'Email Verification'}
          {currentStep === 'verify-phone' && 'Phone Verification'}
          {currentStep === 'password' && 'Create Password'}
        </h1>
        
        {error && (
          <div className="bg-white/[0.08] border border-white/20 rounded-lg p-4 mb-4 backdrop-blur-sm">
            <p className="text-white/80 text-sm font-light">{error}</p>
          </div>
        )}

        {/* Step 1: Personal Information */}
        {currentStep === 'personal-info' && (
          <form onSubmit={handlePersonalInfoSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-light text-white/70 mb-2">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-light text-white/70 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
                placeholder="Last name"
              />
            </div>
          </div>
            <div>
              <label className="block text-sm font-light text-white/70 mb-2">
                Birthday *
              </label>
              <DatePicker
                value={formData.birthday}
                onChange={(date) => setFormData({ ...formData, birthday: date })}
                maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split('T')[0]}
              />
            </div>
            <PremiumButton type="submit" className="w-full" disabled={loading}>
              Continue
            </PremiumButton>
          </form>
        )}

        {/* Step 2: Email and Email Verification */}
        {currentStep === 'verify-email' && !emailCodeSent && (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
                Email Address *
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
            <PremiumButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Send Verification Code'}
            </PremiumButton>
            <button
              type="button"
              onClick={() => setCurrentStep('personal-info')}
              className="w-full text-center text-sm text-white/50 hover:text-white/70 font-light transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {currentStep === 'verify-email' && emailCodeSent && (
          <form onSubmit={handleEmailVerify} className="space-y-5">
            <div className="bg-white/[0.05] border border-white/10 rounded-lg p-4 mb-4">
              <p className="text-white/70 text-sm font-light text-center">
                We sent a verification code to <span className="text-white font-normal">{email}</span>
              </p>
              {devEmailCode && (
                <p className="text-center mt-3 text-xs text-cyan-400/80 font-mono bg-black/20 px-3 py-2 rounded">
                  Dev Code: {devEmailCode}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-light text-white/70 mb-2">
                Enter Verification Code *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light text-center text-2xl tracking-widest"
                placeholder="000000"
              />
            </div>
            <PremiumButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </PremiumButton>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEmailCodeSent(false)
                  setEmail('')
                  setEmailCode('')
                  setDevEmailCode(null)
                  setSessionId(null)
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('signupSessionId')
                  }
                }}
                className="text-sm text-white/50 hover:text-white/70 font-light transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResendEmailCode}
                disabled={resendEmailCooldown > 0}
                className="text-sm text-white/50 hover:text-white/70 font-light transition-colors disabled:opacity-50"
              >
                {resendEmailCooldown > 0 
                  ? `Resend in ${resendEmailCooldown}s`
                  : "Resend Code"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Phone and Phone Verification */}
        {currentStep === 'verify-phone' && !phoneCodeSent && (
          <form onSubmit={handlePhoneSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-light text-white/70 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
                placeholder="+1 (123) 456-7890"
              />
              <p className="mt-1 text-xs text-white/40 font-light">Include country code (e.g., +1 for US/Canada)</p>
            </div>
            <PremiumButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </PremiumButton>
            <button
              type="button"
              onClick={() => {
                setEmailCode('')
                setCurrentStep('verify-email')
              }}
              className="w-full text-center text-sm text-white/50 hover:text-white/70 font-light transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {currentStep === 'verify-phone' && phoneCodeSent && (
          <form onSubmit={handlePhoneVerify} className="space-y-5">
            <div className="bg-white/[0.05] border border-white/10 rounded-lg p-4 mb-4">
              <p className="text-white/70 text-sm font-light text-center">
                We sent a verification code to <span className="text-white font-normal">{phone}</span>
              </p>
              {devPhoneCode && (
                <p className="text-center mt-3 text-xs text-cyan-400/80 font-mono bg-black/20 px-3 py-2 rounded">
                  Dev Code: {devPhoneCode}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-light text-white/70 mb-2">
                Enter Verification Code *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light text-center text-2xl tracking-widest"
                placeholder="000000"
              />
            </div>
            <PremiumButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Phone'}
            </PremiumButton>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPhoneCodeSent(false)
                  setPhone('')
                  setPhoneCode('')
                  setDevPhoneCode(null)
                }}
                className="text-sm text-white/50 hover:text-white/70 font-light transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResendPhoneCode}
                disabled={resendPhoneCooldown > 0}
                className="text-sm text-white/50 hover:text-white/70 font-light transition-colors disabled:opacity-50"
              >
                {resendPhoneCooldown > 0 
                  ? `Resend in ${resendPhoneCooldown}s`
                  : "Resend Code"}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Password */}
        {currentStep === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all backdrop-blur-sm font-light"
              placeholder="••••••••"
            />
            {/* Password Requirements */}
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-white/50 font-light mb-1.5">Password must contain:</p>
              {(() => {
                const validation = validatePassword(formData.password || '')
                return (
                  <>
                    <div className={`text-xs font-light flex items-center gap-2 ${validation.requirements.minLength ? 'text-green-400' : 'text-white/40'}`}>
                      <span>{validation.requirements.minLength ? '✓' : '○'}</span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`text-xs font-light flex items-center gap-2 ${validation.requirements.hasUppercase ? 'text-green-400' : 'text-white/40'}`}>
                      <span>{validation.requirements.hasUppercase ? '✓' : '○'}</span>
                      <span>One uppercase letter</span>
                    </div>
                    <div className={`text-xs font-light flex items-center gap-2 ${validation.requirements.hasLowercase ? 'text-green-400' : 'text-white/40'}`}>
                      <span>{validation.requirements.hasLowercase ? '✓' : '○'}</span>
                      <span>One lowercase letter</span>
                    </div>
                    <div className={`text-xs font-light flex items-center gap-2 ${validation.requirements.hasNumber ? 'text-green-400' : 'text-white/40'}`}>
                      <span>{validation.requirements.hasNumber ? '✓' : '○'}</span>
                      <span>One number</span>
                    </div>
                    <div className={`text-xs font-light flex items-center gap-2 ${validation.requirements.hasSpecialChar ? 'text-green-400' : 'text-white/40'}`}>
                      <span>{validation.requirements.hasSpecialChar ? '✓' : '○'}</span>
                      <span>One special character (!@#$%^&*()_+-=[]&#123;&#125;|;:,&lt;&gt;?)</span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-light text-white/70 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={`w-full px-4 py-3 bg-white/[0.05] border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all backdrop-blur-sm font-light ${
                formData.confirmPassword && formData.password !== formData.confirmPassword
                  ? 'border-red-500/50 focus:border-red-500/50'
                  : formData.confirmPassword && formData.password === formData.confirmPassword
                  ? 'border-green-500/50 focus:border-green-500/50'
                  : 'border-white/10 focus:border-white/20'
              }`}
              placeholder="••••••••"
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="mt-1 text-xs text-red-400 font-light">Passwords do not match</p>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="mt-1 text-xs text-green-400 font-light">✓ Passwords match</p>
            )}
          </div>
          <PremiumButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
          </PremiumButton>
            <button
              type="button"
              onClick={() => {
                setPhoneCode('')
                setPhoneCodeSent(false)
                setCurrentStep('verify-phone')
              }}
              className="w-full text-center text-sm text-white/50 hover:text-white/70 font-light transition-colors"
            >
              ← Back
            </button>
        </form>
        )}

        <p className="mt-6 text-center text-white/60 text-sm font-light">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-white/80 hover:text-white transition-colors underline underline-offset-2">
            Sign In
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
