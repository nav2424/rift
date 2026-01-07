'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import InteractiveDemo from '@/components/InteractiveDemo'

export default function Home() {
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
      {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-6 pt-28 pb-16">
          <div className={`mx-auto max-w-3xl text-center transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full glass-soft px-4 py-2 text-xs text-white/60 mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              TRUST LAYER • DIGITAL DEALS
          </div>
          
            <h1 className="text-5xl md:text-6xl font-medium tracking-tight text-white leading-[1.1]">
              The execution layer for online{" "}
              <span className="text-white/60">deals.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base text-white/55 leading-relaxed">
              Create a Rift, secure payment, verify delivery, and release funds — without trust.
            </p>

            <div className="mt-10 flex items-center justify-center gap-3">
              <Link
                href="/auth/signup"
                className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black hover:opacity-90 transition"
              >
                Create a Rift
            </Link>
              <Link
                href="#how-it-works"
                className="rounded-xl glass-soft px-6 py-3 text-sm font-medium text-white/85 hover:text-white transition"
              >
                See how it works
            </Link>
            </div>
        </div>
      </section>

        {/* How It Works */}
        <section id="how-it-works" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="mb-24 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
              How it works
          </h2>
            <p className="text-white/50 font-light text-sm mt-4">
              Five simple steps to secure any deal
          </p>
        </div>

          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-6 lg:gap-10">
              {[
                { 
                  step: '01', 
                  title: 'Create', 
                  description: 'Set terms and counterparty',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  )
                },
                { 
                  step: '02', 
                  title: 'Secure', 
                  description: 'Funds are locked',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )
                },
                { 
                  step: '03', 
                  title: 'Deliver', 
                  description: 'Proof submitted to Vault',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )
                },
                { 
                  step: '04', 
                  title: 'Verify', 
                  description: 'Buyer confirms',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                },
                { 
                  step: '05', 
                  title: 'Release', 
                  description: 'Funds move instantly',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  )
                }
              ].map((item, index) => (
                <div key={item.step} className="relative text-center md:text-left group">
                  
                  {/* Icon container with glow effect */}
                  <div className="relative mb-6 flex justify-center md:justify-start">
                    <div className="relative inline-flex items-center justify-center">
                      {/* Glow effect */}
                      <div className="absolute inset-0 rounded-2xl bg-emerald-400/10 blur-xl group-hover:bg-emerald-400/20 transition-all duration-300" />
                      
                      {/* Icon container */}
                      <div className="relative rounded-2xl glass-soft p-4 group-hover:bg-white/5 transition-all duration-300 border border-white/5 group-hover:border-emerald-400/30">
                        <div className="text-emerald-400/60 group-hover:text-emerald-400 transition-colors duration-300">
                        {item.icon}
                        </div>
                      </div>
                      
                      {/* Step number badge */}
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center">
                        <span className="text-xs font-mono font-bold text-white/40 group-hover:text-emerald-400/60 transition-colors">
                          {item.step.slice(-1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Step number - large and subtle */}
                  <div className="text-6xl md:text-7xl lg:text-8xl font-bold text-white/6 mb-2 leading-none font-mono tracking-tight group-hover:text-white/10 transition-colors">
                    {item.step}
                  </div>
                  
                  {/* Title - prominent */}
                  <div className="text-xl md:text-2xl font-medium text-white mb-3 tracking-tight group-hover:text-emerald-400/40 transition-colors">
                    {item.title}
                  </div>
                  
                  {/* Description - subtle */}
                  <div className="text-sm md:text-base text-white/55 leading-relaxed max-w-xs mx-auto md:mx-0 group-hover:text-white/70 transition-colors">
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Demo */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-32">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-light text-white/70 mb-2 tracking-tight">
              See it in action
            </h2>
            <p className="text-sm text-white/40 font-light">
              Interactive walkthrough
            </p>
          </div>
          <div className="opacity-90">
            <InteractiveDemo />
          </div>
        </section>

        {/* Use Cases */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="mb-20 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
              Built for every deal
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                title: 'Digital Goods',
                description: 'Usernames, licenses, files, and digital assets',
                primary: false
              },
              {
                title: 'Tickets',
                description: 'Digital transfer with ownership verification and instant release.',
                primary: true
              },
              {
                title: 'Services',
                description: 'Milestone-based work and deliverables',
                primary: false
                }
            ].map((item, index) => (
              <div 
                key={index} 
                className={`transition ${
                  item.primary 
                    ? 'md:-mt-4 md:mb-4 rounded-2xl glass-soft glass-highlight p-8' 
                    : 'rounded-xl glass-soft p-6 opacity-80'
                }`}
              >
                <div className="text-white font-medium text-lg mb-2">{item.title}</div>
                <div className="text-sm text-white/55 leading-relaxed">{item.description}</div>
              </div>
            ))}
        </div>
      </section>

        {/* Trust Layer Features */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="mb-20 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
              Trust layer features
          </h2>
        </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'Private IDs',
                description: 'No directory lookup. Counterparties identified by secure IDs only.',
              },
              {
                title: 'Audit trail',
                description: 'Complete activity log with transparent status updates.',
              },
              {
                title: 'Vault submissions',
                description: 'Secure proof storage with verification window and access controls.',
              },
              {
                title: 'Resolution controls',
                description: 'Clear rules, structured issue submission, and admin review path.',
            }
          ].map((item, index) => (
              <div key={index} className="pb-6 border-b border-white/6">
                <div className="text-white font-medium text-base mb-2">{item.title}</div>
                <div className="text-sm text-white/60 leading-relaxed">{item.description}</div>
              </div>
          ))}
        </div>
      </section>

        {/* Social Proof */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <p className="text-white/50 font-light text-sm mb-12 tracking-wider uppercase">Used by teams, creators, and power sellers</p>
            <div className="max-w-3xl mx-auto">
              <blockquote className="text-xl md:text-2xl font-light text-white/80 italic leading-relaxed mb-6">
                "Rift transformed how we handle client payments. The verification process gives everyone confidence, and disputes are resolved quickly."
              </blockquote>
              <p className="text-white/50 font-light text-sm font-mono">— Creator, Digital Services</p>
            </div>
        </div>
      </section>

        {/* Final CTA */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white mb-10 tracking-tight leading-tight">
              Stop negotiating trust.<br />
              Execute the deal.
              </h2>
              <Link href="/auth/signup">
              <button className="rounded-xl bg-white px-8 py-4 text-base font-medium text-black hover:opacity-90 transition">
                Create a Rift
              </button>
              </Link>
          </div>
      </section>
    </div>
  )
}
