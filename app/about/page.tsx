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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white pt-8 pb-32">
      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-64">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs text-[#86868b] mb-6 sm:mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            ABOUT RIFT • BUILT FOR CREATORS
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium mb-6 tracking-tight leading-tight">
            <span className="text-[#1d1d1f]">
              Making brand deals
            </span>
            <br />
            <span className="text-emerald-600">executable.</span>
          </h1>
          <p className="text-xl text-[#86868b] max-w-2xl mx-auto font-light leading-relaxed">
            We believe creators shouldn't have to chase payments, and brands shouldn't have to worry about deliverables. 
            Rift provides the execution layer that makes influencer partnerships executable without requiring prior trust.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32 bg-[#f5f5f7]">
        <GlassCard className="p-8 lg:p-12 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-start gap-6 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl sm:text-4xl font-medium text-[#1d1d1f] mb-4 tracking-tight">
                Mission
              </h2>
              <p className="text-gray-600 font-light text-lg leading-relaxed mb-4">
                Facilitate transactions between creators and brands. We make brand deals executable by removing trust as a requirement and providing a secure execution layer that protects both sides.
              </p>
              <p className="text-[#86868b] font-light text-base leading-relaxed">
                Creators get paid when work is delivered. Brands get deliverables before payment is released. 
                Everyone wins through transparent, automated processes.
              </p>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Principles */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-500/30" />
            <span className="text-xs font-mono text-emerald-600 uppercase tracking-wider">
              Principles
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-500/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-[#1d1d1f] mb-6 tracking-tight">
            Our <span className="text-emerald-600">Principles</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {[
            { 
              title: 'Clarity', 
              description: 'Transparent rules, clear statuses, no ambiguity. Know exactly where your deal stands.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )
            },
            { 
              title: 'Neutrality', 
              description: 'We don\'t take sides. The protocol decides based on deliverables and evidence.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            },
            { 
              title: 'Proof', 
              description: 'Evidence-based decisions. Vault submissions. Complete audit trails for every deal.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            },
            { 
              title: 'Speed', 
              description: 'Automated flows. Fast resolution. Quick payouts. Get paid when work is done.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )
            }
          ].map((principle, index) => (
            <GlassCard key={index} className="p-6 lg:p-8 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-all group hover:border-gray-300">
              <div className="mb-4 inline-flex items-center justify-center rounded-xl p-3 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                {principle.icon}
              </div>
              <h3 className="text-xl font-medium text-[#1d1d1f] mb-3 group-hover:text-emerald-600 transition-colors">
                {principle.title}
              </h3>
              <p className="text-[#86868b] font-light text-sm leading-relaxed">
                {principle.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Why Now */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32 bg-[#f5f5f7]">
        <GlassCard className="p-8 lg:p-12 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-start gap-6 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl sm:text-4xl font-medium text-[#1d1d1f] mb-6 tracking-tight">
                Why <span className="text-emerald-600">now</span>
              </h2>
              <p className="text-gray-600 font-light text-lg leading-relaxed mb-4">
                The creator economy is growing, but payment disputes and trust issues are holding it back.
              </p>
              <p className="text-[#86868b] font-light text-base leading-relaxed mb-4">
                Creators waste time chasing payments. Brands hesitate to work with new influencers. 
                Agencies struggle with milestone-based payments. Everyone loses when trust is required upfront.
              </p>
              <p className="text-[#86868b] font-light text-base leading-relaxed">
                Rift removes trust as a requirement by providing a secure execution layer that protects both creators and brands through automated verification, 
                transparent protocols, and evidence-based dispute resolution.
              </p>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Security & Privacy */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-500/30" />
            <span className="text-xs font-mono text-emerald-600 uppercase tracking-wider">
              Security
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-500/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-[#1d1d1f] mb-6 tracking-tight">
            Security & <span className="text-emerald-600">Privacy</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {[
            { 
              title: 'Private IDs', 
              description: 'No directory lookup. Counterparties identified by secure IDs only. Your privacy is protected.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )
            },
            { 
              title: 'Least-privilege access', 
              description: 'Only parties involved in a deal can access its details. Complete privacy by default.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )
            },
            { 
              title: 'Vault access restricted', 
              description: 'Deliverables are encrypted and access-controlled. Only authorized parties can view content.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )
            }
          ].map((item, index) => (
            <GlassCard key={index} className="p-6 lg:p-8 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-all group hover:border-gray-300">
              <div className="mb-4 inline-flex items-center justify-center rounded-xl p-3 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                {item.icon}
              </div>
              <h3 className="text-xl font-medium text-[#1d1d1f] mb-3 group-hover:text-emerald-600 transition-colors">
                {item.title}
              </h3>
              <p className="text-[#86868b] font-light text-sm leading-relaxed">
                {item.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-32 bg-[#f5f5f7]">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-emerald-500/30" />
            <span className="text-xs font-mono text-emerald-600 uppercase tracking-wider">
              Ready to start
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-emerald-500/30" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-[#1d1d1f] mb-8 tracking-tight leading-tight">
            Stop chasing payments.<br />
            Secure your brand deals.
          </h2>
          <Link href="/auth/signup">
            <PremiumButton size="lg" className="min-w-[220px]" glow>
              Create a Rift
            </PremiumButton>
          </Link>
        </div>
      </section>
    </div>
  )
}
