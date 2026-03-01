'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView()
  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 2000
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target])
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (status === 'authenticated') router.push('/dashboard') }, [status, router])

  const stats = useInView()
  const howItWorks = useInView()
  const useCases = useInView()
  const trust = useInView()
  const social = useInView()
  const cta = useInView()

  if (status === 'authenticated' || status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-28 sm:pt-36 md:pt-44 pb-16 sm:pb-24">
        <div className={`mx-auto max-w-4xl text-center transition-all duration-[1200ms] ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs tracking-wide text-[#86868b] mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            TRUSTED BY CREATORS & AGENCIES
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[72px] font-semibold tracking-[-0.04em] text-[#1d1d1f] leading-[1.05]">
            The payment layer for<br />
            <span className="text-[#86868b]">creator deals.</span>
          </h1>

          <p className="mx-auto mt-6 sm:mt-8 max-w-2xl text-lg sm:text-xl text-[#86868b] leading-relaxed font-light">
            Rift secures payments between creators and brands. Funds are locked on day one and released when work is delivered.
          </p>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="group w-full sm:w-auto rounded-full bg-[#1d1d1f] px-8 py-4 text-[15px] font-semibold text-[#1d1d1f] hover:bg-white transition-all duration-300 flex items-center justify-center gap-2"
            >
              Start for free
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto rounded-full border border-gray-200 px-8 py-4 text-[15px] font-medium text-[#1d1d1f] hover:bg-gray-50 transition-all duration-300 flex items-center justify-center"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-[#f5f5f7] py-16 sm:py-20">
        <div
          ref={stats.ref}
          className={`max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 transition-all duration-1000 ${stats.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          {[
            { value: 10000, suffix: '+', label: 'Transactions secured' },
            { value: 2, prefix: '$', suffix: 'M+', label: 'Funds protected' },
            { value: 99, suffix: '%', label: 'Dispute resolution' },
            { value: 4, suffix: '.9', label: 'Creator rating' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
              </div>
              <div className="text-sm text-[#86868b]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div ref={howItWorks.ref} className={`transition-all duration-1000 ${howItWorks.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Process</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
              Five steps to get paid.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-4">
            {[
              { num: '01', title: 'Create', desc: 'Set terms, deliverables, and milestones', icon: 'M12 4v16m8-8H4' },
              { num: '02', title: 'Secure', desc: 'Brand funds the deal upfront', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
              { num: '03', title: 'Deliver', desc: 'Upload content to the vault', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
              { num: '04', title: 'Approve', desc: 'Brand reviews and signs off', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { num: '05', title: 'Release', desc: 'Funds transfer instantly', icon: 'M13 7l5 5m0 0l-5 5m5-5H6' },
            ].map((step, i) => (
              <div key={step.num} className="group text-center md:text-left">
                <div className="mb-4 flex justify-center md:justify-start">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 group-hover:border-emerald-200 group-hover:bg-emerald-50 transition-all duration-400">
                    <svg className="w-6 h-6 text-[#86868b] group-hover:text-emerald-600 transition-colors duration-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                    </svg>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#86868b]/60 mb-1 tracking-widest">{step.num}</div>
                <div className="text-lg font-semibold text-[#1d1d1f] mb-1">{step.title}</div>
                <div className="text-sm text-[#86868b] leading-relaxed">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section className="bg-[#f5f5f7] py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div ref={useCases.ref} className={`transition-all duration-1000 ${useCases.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Use Cases</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                Built for the creator economy.
              </h2>
              <p className="mt-4 text-[#86868b] text-lg max-w-2xl mx-auto">From solo creators to enterprise agencies — one platform for every deal.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: 'Brand Deals', desc: 'Sponsored posts, ambassador programs, and influencer partnerships with milestone-based payouts.', metric: 'Up to 50% faster payments', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
                { title: 'UGC Content', desc: 'Video production, photo shoots, and social content with secure file delivery through the vault.', metric: 'Zero-trust file delivery', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                { title: 'Agency Work', desc: 'Multi-milestone projects, creative retainers, and production work with transparent fee tracking.', metric: 'Full audit trail', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
              ].map((item, i) => (
                <div key={i} className="group bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-400">
                  <div className="mb-5 inline-flex items-center justify-center rounded-xl p-3 bg-gray-50 text-[#86868b] group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all duration-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                  <div className="text-lg font-semibold text-[#1d1d1f] mb-2">{item.title}</div>
                  <div className="text-sm text-[#86868b] leading-relaxed mb-5">{item.desc}</div>
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-600">
                    <span className="h-px w-4 bg-emerald-300" />
                    {item.metric}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST LAYER ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div ref={trust.ref} className={`transition-all duration-1000 ${trust.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Security</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
              Enterprise-grade trust layer.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Private Rift IDs', desc: 'No directory lookup. Counterparties identified by secure IDs only — your identity stays yours.', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
              { title: 'Immutable audit trail', desc: 'Every action is logged. Transparent status updates, timestamped events, and complete deal history.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              { title: 'Encrypted vault', desc: 'AES-256 encrypted file storage with magic-byte scanning, hash verification, and view-only access controls.', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
              { title: 'Dispute resolution', desc: 'Structured issue submission with evidence packets, admin review path, and automated freeze controls.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            ].map((item, i) => (
              <div key={i} className="group rounded-2xl border border-gray-200 bg-white p-7 hover:shadow-md transition-all duration-400">
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 rounded-xl p-3 bg-gray-50 text-[#86868b] group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all duration-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[#1d1d1f] font-semibold text-lg mb-1">{item.title}</div>
                    <div className="text-sm text-[#86868b] leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="bg-[#f5f5f7] py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div ref={social.ref} className={`text-center transition-all duration-1000 ${social.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <blockquote className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#1d1d1f] leading-snug tracking-tight mb-8">
              "Rift changed how we handle brand deals. Funds secured upfront, released on approval. Game changer."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-cyan-100 flex items-center justify-center text-sm font-semibold text-emerald-700">J</div>
              <div className="text-left">
                <div className="text-sm font-semibold text-[#1d1d1f]">Jamie R.</div>
                <div className="text-xs text-[#86868b]">Content Creator • 500K+ Followers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 md:py-40">
        <div ref={cta.ref} className={`text-center transition-all duration-1000 ${cta.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#1d1d1f] leading-tight mb-6">
            Stop chasing payments.<br />
            <span className="text-[#86868b]">Start closing deals.</span>
          </h2>
          <p className="text-[#86868b] text-lg max-w-xl mx-auto mb-10">
            Join thousands of creators and agencies securing their brand deals with Rift.
          </p>
          <Link href="/auth/signup" className="group inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-10 py-4.5 text-[15px] font-semibold text-[#1d1d1f] hover:bg-white transition-all duration-300">
            Get Started Free
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <p className="mt-5 text-xs text-[#86868b]">No credit card required • Free for your first deal</p>
        </div>
      </section>
    </div>
  )
}
