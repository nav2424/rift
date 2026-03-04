'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import GlassCard from '@/components/ui/GlassCard'

const INDUSTRIES = [
  'E-Commerce', 'SaaS', 'Fashion', 'Beauty', 'Food & Beverage', 'Health & Wellness',
  'Finance', 'Technology', 'Entertainment', 'Travel', 'Education', 'Real Estate',
  'Automotive', 'Sports', 'Non-Profit', 'Other',
] as const

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const

export default function BrandOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    website: '',
    bio: '',
    monthlyBudget: '',
    currency: 'CAD',
  })

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = () => {
    if (step === 1 && !form.companyName.trim()) {
      setError('Company name is required.')
      return false
    }
    return true
  }

  const next = () => {
    if (!validateStep()) return
    setStep(s => Math.min(s + 1, 2))
  }

  const back = () => setStep(s => Math.max(s - 1, 1))

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/me/profile/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          industry: form.industry || null,
          website: form.website.trim() || null,
          bio: form.bio.trim() || null,
          monthlyBudget: parseFloat(form.monthlyBudget) || null,
          currency: form.currency,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile')
      }
      router.push('/brand')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 transition-colors'
  const selectClass =
    'w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-[#1d1d1f] focus:outline-none focus:border-gray-300 transition-colors'
  const labelClass = 'block text-sm font-medium text-[#1d1d1f] mb-2'

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">
              Set up your Brand profile
            </h1>
            <span className="text-sm text-[#86868b]">Step {step}/2</span>
          </div>
          <div className="flex gap-2">
            {[1, 2].map(s => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  s <= step ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <GlassCard className="p-6 sm:p-8 border border-gray-200 bg-white">
          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Company Name *</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => update('companyName', e.target.value)}
                  placeholder="Your company name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Industry</label>
                <select
                  value={form.industry}
                  onChange={e => update('industry', e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={e => update('website', e.target.value)}
                  placeholder="https://yourcompany.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => update('bio', e.target.value)}
                  placeholder="Tell creators about your brand..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          )}

          {/* Step 2: Budget */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-[#86868b] mb-2">
                Set your monthly influencer marketing budget so we can match you with the right creators.
              </p>
              <div>
                <label className={labelClass}>Currency</label>
                <select
                  value={form.currency}
                  onChange={e => update('currency', e.target.value)}
                  className={selectClass}
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Monthly Budget</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.monthlyBudget}
                  onChange={e => update('monthlyBudget', e.target.value)}
                  placeholder="5000.00"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={back}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-gray-100 transition-all"
              >
                Back
              </button>
            ) : (
              <div />
            )}
            {step < 2 ? (
              <button
                onClick={next}
                className="px-6 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
