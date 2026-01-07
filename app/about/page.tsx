'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

export default function About() {
  const { data: session, status } = useSession()
  const router = useRouter()

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
    <div className="min-h-screen relative overflow-hidden bg-black pt-8 pb-32">
        {/* Hero */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white mb-6 tracking-tight">
              About Rift
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto font-light">
              Making online transactions executable.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12">
            <h2 className="text-3xl font-light text-white mb-6">Mission</h2>
            <p className="text-white/80 font-light text-lg leading-relaxed mb-4">
              Make online transactions executable.
            </p>
            <p className="text-white/70 font-light leading-relaxed">
              We believe that trust shouldn\'t be a prerequisite for commerce. 
              Rift provides the execution layer that makes deals happen without requiring 
              either party to trust the other first.
            </p>
          </GlassCard>
        </section>

        {/* Principles */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">Principles</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Clarity',
                description: 'Every rule, fee, and process is transparent. No surprises.',
              },
              {
                title: 'Neutrality',
                description: 'We don\'t take sides. The protocol enforces fairness.',
              },
              {
                title: 'Proof',
                description: 'Evidence-based verification. No trust required.',
              },
              {
                title: 'Speed',
                description: 'Fast execution. Minimal friction. Maximum efficiency.',
              },
            ].map((principle, index) => (
              <GlassCard key={index} className="p-6">
                <h3 className="text-xl font-light text-white mb-3">{principle.title}</h3>
                <p className="text-white/60 font-light text-sm leading-relaxed">{principle.description}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Why Now */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12">
            <h2 className="text-3xl font-light text-white mb-6">Why now</h2>
            <div className="space-y-4 text-white/70 font-light leading-relaxed">
              <p>
                Online scams and trust collapse are at an all-time high. 
                Traditional payment methods offer no protection for peer-to-peer transactions.
              </p>
              <p>
                Marketplaces take massive cuts and still leave users vulnerable. 
                Banks aren\'t built for this use case.
              </p>
              <p>
                Rift fills the gap: a neutral execution layer that makes online deals 
                executable without requiring trust or paying marketplace fees.
              </p>
            </div>
          </GlassCard>
        </section>

        {/* Security & Privacy */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">Security & privacy</h2>
          </div>

          <div className="space-y-6">
            {[
              {
                title: 'Private IDs',
                description: 'No directory lookup. Users are identified by secure IDs only. No browsing or discovery.',
              },
              {
                title: 'Least-privilege access',
                description: 'Access is restricted to what\'s necessary. Admins only see what\'s needed for review.',
              },
              {
                title: 'Vault access restricted',
                description: 'Vault contents are encrypted and only accessible to authorized parties during active transactions.',
              },
            ].map((item, index) => (
              <GlassCard key={index} className="p-6">
                <h3 className="text-lg font-light text-white mb-3">{item.title}</h3>
                <p className="text-white/60 font-light text-sm leading-relaxed">{item.description}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Link href="/auth/signup">
              <PremiumButton size="lg" className="min-w-[200px]" glow>
                Create a Rift
              </PremiumButton>
            </Link>
          </div>
        </section>
      </div>
  )
}
