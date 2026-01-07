'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

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
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 lg:pt-32 lg:pb-24">
          <div className={`text-center transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full glass stroke px-4 py-2 text-xs text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              TRUST LAYER • DIGITAL DEALS
          </div>
          
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 mb-6 leading-[1.1]">
              The execution layer for online deals.
            </h1>
            
            <p className="mx-auto mt-6 max-w-xl text-base text-white/60 leading-relaxed mb-8">
              Create a Rift, secure payment, verify delivery, and release funds — without trust.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link href="/auth/signup">
                <PremiumButton size="lg" variant="primary" className="min-w-[220px]">
                  Create a Rift
              </PremiumButton>
            </Link>
              <Link href="#how-it-works">
                <PremiumButton size="lg" variant="outline" className="min-w-[220px]">
                  See how it works
              </PremiumButton>
            </Link>
          </div>

            {/* Hero Product Panel */}
            <div className="mx-auto mt-12 max-w-5xl rounded-3xl glass liquid stroke p-6">
              <div className="rounded-2xl bg-black/40 stroke p-6">
                <div className="text-sm text-white/70">Rift Status</div>
                <div className="mt-2 text-2xl font-semibold text-white">Verification pending</div>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="rounded-2xl glass stroke p-4">
                    <div className="text-xs text-white/60">Payment</div>
                    <div className="mt-2 text-white font-medium">Secured</div>
              </div>
                  <div className="rounded-2xl glass stroke p-4">
                    <div className="text-xs text-white/60">Vault</div>
                    <div className="mt-2 text-white font-medium">Proof uploaded</div>
                  </div>
                  <div className="rounded-2xl glass stroke p-4">
                    <div className="text-xs text-white/60">Release</div>
                    <div className="mt-2 text-white font-medium">Locked</div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </section>

        {/* Section Separator */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="my-20 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* How It Works */}
        <section id="how-it-works" className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-5 gap-6 lg:gap-8">
            {[
              {
                step: '1',
                title: 'Create a Rift',
                description: 'Set terms, amount, and counterparty',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )
              },
              {
                step: '2',
                title: 'Secure payment',
                description: 'Buyer pays; funds are secured',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )
              },
              {
                step: '3',
                title: 'Deliver to Vault',
                description: 'Seller submits proof to secure vault',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )
              },
              {
                step: '4',
                title: 'Verify',
                description: 'Review and confirm delivery',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                step: '5',
                title: 'Release',
                description: 'Funds released to seller',
                  icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                )
              }
            ].map((item) => (
              <div key={item.step} className="group glass liquid stroke rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl glass stroke">
                            {item.icon}
                          </div>
                <div className="text-white text-base font-semibold">{item.title}</div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
        </div>
      </section>

        {/* Section Separator */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="my-20 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Use Cases */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
              Built for every deal
          </h2>
        </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                title: 'Digital Goods',
                description: 'Usernames, licenses, files, and digital assets',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            },
            {
                title: 'Tickets',
                description: 'Digital transfer with verification',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              )
            },
            {
                title: 'Services',
                description: 'Milestone-based work and deliverables',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )
            }
          ].map((item, index) => (
              <div key={index} className="group glass liquid stroke rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl glass stroke">
                  {item.icon}
                </div>
                <div className="text-white text-base font-semibold">{item.title}</div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
          ))}
        </div>
      </section>

        {/* Section Separator */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="my-20 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Trust Layer Features */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-4 tracking-tight">
              Trust layer features
          </h2>
        </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {[
            {
                title: 'Private IDs',
                description: 'No directory lookup. Counterparties identified by secure IDs only.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )
            },
            {
                title: 'Audit trail',
                description: 'Complete activity log with transparent status updates.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )
            },
            {
                title: 'Vault submissions',
                description: 'Secure proof storage with verification window and access controls.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )
            },
            {
                title: 'Resolution controls',
                description: 'Clear rules, structured issue submission, and admin review path.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )
            }
          ].map((item, index) => (
              <div key={index} className="group glass liquid stroke rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl glass stroke">
                  {item.icon}
                </div>
                <div className="text-white text-base font-semibold">{item.title}</div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
          ))}
        </div>
      </section>

        {/* Section Separator */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="my-20 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Social Proof */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-12">
            <p className="text-white/60 font-light text-sm mb-8">Used by teams, creators, and power sellers.</p>
            <GlassCard className="p-8 max-w-2xl mx-auto">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                </div>
                <div>
                  <p className="text-white/80 font-light mb-2 italic">
                    "Rift transformed how we handle client payments. The verification process gives everyone confidence, and disputes are resolved quickly."
                  </p>
                  <p className="text-white/50 font-light text-sm">— Creator, Digital Services</p>
                </div>
              </div>
            </GlassCard>
        </div>
      </section>

        {/* Final CTA */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-6 tracking-tight">
              Stop negotiating trust. Execute the deal.
              </h2>
              <Link href="/auth/signup">
              <PremiumButton size="lg" variant="primary" className="min-w-[220px]">
                Create a Rift
                </PremiumButton>
              </Link>
          </div>
        </section>
      </div>
  )
}
