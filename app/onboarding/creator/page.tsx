'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import GlassCard from '@/components/ui/GlassCard'

const NICHES = [
  'LIFESTYLE', 'FASHION', 'BEAUTY', 'FITNESS', 'FOOD', 'TRAVEL',
  'TECH', 'GAMING', 'FINANCE', 'EDUCATION', 'ENTERTAINMENT', 'MUSIC',
  'SPORTS', 'HEALTH', 'PARENTING', 'PETS', 'HOME', 'AUTO', 'OTHER',
] as const

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Twitter'] as const

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const

export default function CreatorOnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    displayName: session?.user?.name || '',
    bio: '',
    niche: 'OTHER' as string,
    platform: 'Instagram',
    handle: '',
    followers: '',
    avgViews: '',
    engagementRate: '',
    postRate: '',
    storyRate: '',
    videoRate: '',
    packageRate: '',
    currency: 'CAD',
  })

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = () => {
    if (step === 1 && !form.displayName.trim()) {
      setError('Display name is required.')
      return false
    }
    if (step === 2 && !form.handle.trim()) {
      setError('Handle is required.')
      return false
    }
    return true
  }

  const next = () => {
    if (!validateStep()) return
    setStep(s => Math.min(s + 1, 3))
  }

  const back = () => setStep(s => Math.max(s - 1, 1))

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/me/profile/creator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          bio: form.bio.trim() || null,
          niche: form.niche,
          platform: form.platform.toLowerCase(),
          handle: form.handle.trim(),
          followers: parseInt(form.followers) || 0,
          avgViews: parseInt(form.avgViews) || 0,
          engagementRate: parseFloat(form.engagementRate) || 0,
          postRate: parseFloat(form.postRate) || null,
          storyRate: parseFloat(form.storyRate) || null,
          videoRate: parseFloat(form.videoRate) || null,
          packageRate: parseFloat(form.packageRate) || null,
          currency: form.currency,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save profile')
      }
      router.push('/creator')
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
              Set up your Creator profile
            </h1>
            <span className="text-sm text-[#86868b]">Step {step}/3</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  s <= step ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        <GlassCard className="p-6 sm:p-8 border border-gray-200 bg-white">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Display Name *</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={e => update('displayName', e.target.value)}
                  placeholder="Your creator name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => update('bio', e.target.value)}
                  placeholder="Tell brands about yourself..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div>
                <label className={labelClass}>Niche *</label>
                <select
                  value={form.niche}
                  onChange={e => update('niche', e.target.value)}
                  className={selectClass}
                >
                  {NICHES.map(n => (
                    <option key={n} value={n}>
                      {n.charAt(0) + n.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Platform & Stats */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Primary Platform *</label>
                <select
                  value={form.platform}
                  onChange={e => update('platform', e.target.value)}
                  className={selectClass}
                >
                  {PLATFORMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Handle *</label>
                <input
                  type="text"
                  value={form.handle}
                  onChange={e => update('handle', e.target.value)}
                  placeholder="@yourhandle"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Followers</label>
                  <input
                    type="number"
                    value={form.followers}
                    onChange={e => update('followers', e.target.value)}
                    placeholder="10000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Avg Views</label>
                  <input
                    type="number"
                    value={form.avgViews}
                    onChange={e => update('avgViews', e.target.value)}
                    placeholder="5000"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Engagement Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.engagementRate}
                  onChange={e => update('engagementRate', e.target.value)}
                  placeholder="3.5"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Step 3: Rate Card */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-[#86868b] mb-2">
                Set your rates so brands know what to expect. All fields are optional.
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Post Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.postRate}
                    onChange={e => update('postRate', e.target.value)}
                    placeholder="250.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Story Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.storyRate}
                    onChange={e => update('storyRate', e.target.value)}
                    placeholder="100.00"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Video Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.videoRate}
                    onChange={e => update('videoRate', e.target.value)}
                    placeholder="500.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Package Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.packageRate}
                    onChange={e => update('packageRate', e.target.value)}
                    placeholder="1000.00"
                    className={inputClass}
                  />
                </div>
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
            {step < 3 ? (
              <button
                onClick={next}
                className="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
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
