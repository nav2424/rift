'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function OnboardingPage() {
  const router = useRouter()
  const [selecting, setSelecting] = useState(false)

  const selectRole = async (role: 'CREATOR' | 'BRAND') => {
    setSelecting(true)
    try {
      await fetch('/api/me/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      })
      router.push(role === 'CREATOR' ? '/onboarding/creator' : '/onboarding/brand')
    } catch {
      setSelecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tracking-tight">
            How will you use Rift?
          </h1>
          <p className="mt-3 text-[#86868b] text-lg">Choose your role to personalize your experience.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Creator Card */}
          <button
            onClick={() => selectRole('CREATOR')}
            disabled={selecting}
            className="group text-left p-8 rounded-2xl bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">I&apos;m a Creator</h2>
            <p className="text-[#86868b] text-sm leading-relaxed">
              Manage brand deals, track earnings, deliver content, and get paid securely. Set your rates and grow your business.
            </p>
          </button>

          {/* Brand Card */}
          <button
            onClick={() => selectRole('BRAND')}
            disabled={selecting}
            className="group text-left p-8 rounded-2xl bg-white border border-gray-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">I&apos;m a Brand</h2>
            <p className="text-[#86868b] text-sm leading-relaxed">
              Find influencers, manage campaigns, track spend, analyze ROI, and pay creators through secure escrow.
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
