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
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-64">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
            <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
              About
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium mb-6 tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              Making online transactions
            </span>
            <br />
            <span className="text-emerald-400/40">executable.</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto font-light leading-relaxed">
            We believe trust shouldn't be a prerequisite for commerce. Rift provides the execution layer that makes online deals executable without requiring prior trust between parties.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <GlassCard className="p-8 lg:p-12 glass-highlight">
          <div className="flex items-start gap-6 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl sm:text-4xl font-medium text-white mb-4 tracking-tight">
                Mission
              </h2>
              <p className="text-white/70 font-light text-lg leading-relaxed">
                Make online transactions executable. We remove trust as a requirement by providing a secure execution layer that protects both buyers and sellers.
              </p>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Principles */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
            <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
              Principles
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight">
            Our <span className="text-emerald-400/40">Principles</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {[
            { 
              title: 'Clarity', 
              description: 'Transparent rules, clear statuses, no ambiguity.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )
            },
            { 
              title: 'Neutrality', 
              description: 'We don't take sides. The protocol decides.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            },
            { 
              title: 'Proof', 
              description: 'Evidence-based decisions. Vault submissions. Audit trails.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            },
            { 
              title: 'Speed', 
              description: 'Automated flows. Fast resolution. Quick payouts.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )
            }
          ].map((principle, index) => (
            <GlassCard key={index} className="p-6 lg:p-8 glass-highlight hover:bg-white/[0.02] transition-all group border border-white/5 hover:border-white/10">
              <div className="mb-4 inline-flex items-center justify-center rounded-xl p-3 bg-emerald-400/10 text-emerald-400 group-hover:bg-emerald-400/15 transition-colors">
                {principle.icon}
              </div>
              <h3 className="text-xl font-medium text-white mb-3 group-hover:text-emerald-400/30 transition-colors">
                {principle.title}
              </h3>
              <p className="text-white/60 font-light text-sm leading-relaxed">
                {principle.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Why Now */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <GlassCard className="p-8 lg:p-12 glass-highlight">
          <div className="flex items-start gap-6 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">
                Why <span className="text-emerald-400/40">now</span>
              </h2>
              <p className="text-white/70 font-light text-lg leading-relaxed mb-4">
                Online scams and trust collapse make secure transactions essential.
              </p>
              <p className="text-white/60 font-light text-base leading-relaxed">
                Traditional payment methods require trust that often doesn't exist. Rift removes trust as a requirement by providing a secure execution layer that protects both buyers and sellers through automated verification and transparent protocols.
              </p>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Security & Privacy */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
            <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
              Security
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight">
            Security & <span className="text-emerald-400/40">Privacy</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {[
            { 
              title: 'Private IDs', 
              description: 'No directory lookup. Counterparties identified by secure IDs only.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )
            },
            { 
              title: 'Least-privilege access', 
              description: 'Only parties involved in a transaction can access its details.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )
            },
            { 
              title: 'Vault access restricted', 
              description: 'Proof submissions are encrypted and access-controlled.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )
            }
          ].map((item, index) => (
            <GlassCard key={index} className="p-6 lg:p-8 glass-highlight hover:bg-white/[0.02] transition-all group border border-white/5 hover:border-white/10">
              <div className="mb-4 inline-flex items-center justify-center rounded-xl p-3 bg-emerald-400/10 text-emerald-400 group-hover:bg-emerald-400/15 transition-colors">
                {item.icon}
              </div>
              <h3 className="text-xl font-medium text-white mb-3 group-hover:text-emerald-400/30 transition-colors">
                {item.title}
              </h3>
              <p className="text-white/60 font-light text-sm leading-relaxed">
                {item.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-emerald-400/30" />
            <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
              Ready to start
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-emerald-400/30" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white mb-8 tracking-tight leading-tight">
            Stop negotiating trust.<br />
            Execute the deal.
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
