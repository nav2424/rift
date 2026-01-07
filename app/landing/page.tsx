'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

export default function LandingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  if (status === 'authenticated' || status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
        {/* Hero */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 lg:pt-32 lg:pb-24">
          <div className={`text-center transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white mb-6 tracking-tight">
              Why Rift beats sending money first
            </h1>
            <p className="text-xl sm:text-2xl text-white/80 max-w-3xl mx-auto font-light mb-8">
              The execution layer that makes online deals executable.
            </p>
          </div>
        </section>

        {/* The Problem */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">The problem</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <GlassCard className="p-8">
              <h3 className="text-xl font-light text-white mb-4">Buyer risk</h3>
              <ul className="space-y-3 text-white/70 font-light text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Payment sent, goods never arrive</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Item not as described, no recourse</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Fake sellers disappear after payment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>No verification or proof required</span>
                </li>
              </ul>
            </GlassCard>

            <GlassCard className="p-8">
              <h3 className="text-xl font-light text-white mb-4">Seller risk</h3>
              <ul className="space-y-3 text-white/70 font-light text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Goods shipped, payment never received</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Chargebacks after delivery</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Buyer disputes legitimate transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>No protection from fraudulent buyers</span>
                </li>
              </ul>
            </GlassCard>
          </div>
        </section>

        {/* Rift Protocol */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">Rift Protocol</h2>
            <p className="text-white/60 font-light max-w-2xl mx-auto">
              How we execute deals without trust
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                title: 'Terms are locked',
                description: 'Amount, delivery method, and verification window are set before payment.',
              },
              {
                title: 'Payment is secured',
                description: 'Funds are held securely until both parties confirm satisfaction.',
              },
              {
                title: 'Delivery is submitted to the Vault',
                description: 'Proof of delivery goes to a secure vault, not directly to the buyer.',
              },
              {
                title: 'Verification window',
                description: 'Buyer has a set period to review and confirm delivery.',
              },
              {
                title: 'Release rules',
                description: 'Funds release automatically after verification, or through structured resolution if issues arise.',
              }
            ].map((item, index) => (
              <GlassCard key={index} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 flex-shrink-0 text-sm font-light">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-light text-white mb-2">{item.title}</h3>
                    <p className="text-white/60 font-light text-sm">{item.description}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Safety by Design */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">Safety by design</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              'Private IDs, no browsing users',
              'Transparent statuses',
              'Activity audit trail',
              'Admin review path',
              'Abuse prevention (rate limits, holds for new accounts, risk scoring hooks)',
            ].map((item, index) => (
              <GlassCard key={index} className="p-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-white/80 font-light text-sm">{item}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Built for Scale */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <GlassCard className="p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">Built for scale</h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-4 text-white/70 font-light text-sm">
              <p>
                Rift is API-ready and designed for integration. Future integrations will enable automated workflows, 
                marketplace connections, and enterprise-grade features.
              </p>
              <p>
                The protocol is built to handle high transaction volumes with minimal friction, 
                ensuring fast execution and reliable performance.
              </p>
            </div>
          </GlassCard>
        </section>

        {/* CTAs */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth/signup">
              <PremiumButton size="lg" className="min-w-[200px]" glow>
                Create a Rift
              </PremiumButton>
            </Link>
            <Link href="/pricing">
              <PremiumButton size="lg" variant="outline" className="min-w-[200px]">
                View pricing
              </PremiumButton>
            </Link>
          </div>
        </section>
      </div>
  )
}

