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

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  const hero = useInView(0.1)
  const stats = useInView()
  const howItWorks = useInView()
  const useCases = useInView()
  const trust = useInView()
  const social = useInView()
  const cta = useInView()

  if (status === 'authenticated' || status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[40%] -left-[20%] w-[80vw] h-[80vw] rounded-full bg-emerald-500/[0.03] blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[30%] -right-[20%] w-[70vw] h-[70vw] rounded-full bg-cyan-500/[0.02] blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[60vw] h-[40vw] rounded-full bg-indigo-500/[0.015] blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* ───────── HERO ───────── */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-28 sm:pt-36 md:pt-44 pb-20 sm:pb-28">
        <div
          ref={hero.ref}
          className={`mx-auto max-w-4xl text-center transition-all duration-[1200ms] ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          {/* Badge */}
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm px-4 py-2 text-xs tracking-wide text-white/50 mb-8 sm:mb-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            TRUSTED BY CREATORS & AGENCIES
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-[-0.04em] text-white leading-[1.05]">
            The payment layer for{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              creator deals
            </span>
          </h1>

          <p className="mx-auto mt-6 sm:mt-8 max-w-2xl text-base sm:text-lg text-white/50 leading-relaxed font-light">
            Rift secures payments between creators and brands. Funds are locked on day one and released when work is delivered. No invoices. No chasing. Just trust.
          </p>

          {/* CTAs */}
          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="group relative w-full sm:w-auto rounded-2xl bg-white px-8 py-4 text-[15px] font-semibold text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              Start for free
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm px-8 py-4 text-[15px] font-medium text-white/70 hover:text-white hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-300 flex items-center justify-center"
            >
              See how it works
            </Link>
          </div>

          {/* Subtle social proof line */}
          <p className="mt-10 text-xs text-white/30 font-light tracking-wide">
            Securing brand deals across North America
          </p>
        </div>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div
          ref={stats.ref}
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 transition-all duration-1000 ${stats.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          {[
            { value: 10000, suffix: '+', label: 'Transactions secured' },
            { value: 2, prefix: '$', suffix: 'M+', label: 'Funds protected' },
            { value: 99, suffix: '%', label: 'Dispute resolution' },
            { value: 4, suffix: '.9', label: 'Creator rating' },
          ].map((stat, i) => (
            <div key={i} className="text-center group">
              <div className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
              </div>
              <div className="text-xs sm:text-sm text-white/40 font-light tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section id="how-it-works" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div
          ref={howItWorks.ref}
          className={`transition-all duration-1000 ${howItWorks.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="text-center mb-16 sm:mb-20">
            <span className="text-xs font-mono text-emerald-400/50 uppercase tracking-[0.2em] mb-4 block">Process</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-white leading-tight">
              Five steps to get <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">paid</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-4 lg:gap-6">
            {[
              { num: '01', title: 'Create', desc: 'Set terms, deliverables, and milestones', icon: 'M12 4v16m8-8H4' },
              { num: '02', title: 'Secure', desc: 'Brand funds the deal upfront', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
              { num: '03', title: 'Deliver', desc: 'Upload content to the vault', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
              { num: '04', title: 'Approve', desc: 'Brand reviews and signs off', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { num: '05', title: 'Release', desc: 'Funds transfer instantly', icon: 'M13 7l5 5m0 0l-5 5m5-5H6' },
            ].map((step, i) => (
              <div
                key={step.num}
                className="group relative text-center md:text-left"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="relative mb-5 flex justify-center md:justify-start">
                  <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 group-hover:border-emerald-400/20 group-hover:bg-emerald-400/[0.04] transition-all duration-500">
                    <svg className="w-7 h-7 text-white/40 group-hover:text-emerald-400 transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                    </svg>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-white/20 mb-2 tracking-widest">{step.num}</div>
                <div className="text-lg font-medium text-white mb-2 tracking-tight">{step.title}</div>
                <div className="text-sm text-white/45 leading-relaxed font-light">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── USE CASES ───────── */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div
          ref={useCases.ref}
          className={`transition-all duration-1000 ${useCases.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="text-center mb-16 sm:mb-20">
            <span className="text-xs font-mono text-emerald-400/50 uppercase tracking-[0.2em] mb-4 block">Use Cases</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-white leading-tight">
              Built for the <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">creator economy</span>
            </h2>
            <p className="mt-5 text-white/45 font-light text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              From solo creators to enterprise agencies — one platform for every deal.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
            {[
              {
                title: 'Brand Deals',
                desc: 'Sponsored posts, ambassador programs, and influencer partnerships with milestone-based payouts.',
                metric: 'Up to 50% faster payments',
                icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
              },
              {
                title: 'UGC Content',
                desc: 'Video production, photo shoots, and social content with secure file delivery through the vault.',
                metric: 'Zero-trust file delivery',
                icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
              },
              {
                title: 'Agency Work',
                desc: 'Multi-milestone projects, creative retainers, and production work with transparent fee tracking.',
                metric: 'Full audit trail',
                icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-7 sm:p-8 hover:border-emerald-400/15 hover:bg-white/[0.03] transition-all duration-500 hover:-translate-y-1"
              >
                <div className="mb-5 inline-flex items-center justify-center rounded-xl p-3 bg-white/[0.04] text-white/50 group-hover:bg-emerald-400/10 group-hover:text-emerald-400 transition-all duration-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <div className="text-lg font-medium text-white mb-3 tracking-tight">{item.title}</div>
                <div className="text-sm text-white/45 leading-relaxed font-light mb-5">{item.desc}</div>
                <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400/50 group-hover:text-emerald-400/80 transition-colors">
                  <span className="h-px w-4 bg-emerald-400/30" />
                  {item.metric}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── TRUST LAYER ───────── */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div
          ref={trust.ref}
          className={`transition-all duration-1000 ${trust.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="text-center mb-16 sm:mb-20">
            <span className="text-xs font-mono text-emerald-400/50 uppercase tracking-[0.2em] mb-4 block">Security</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-white leading-tight">
              Enterprise-grade <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">trust layer</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
            {[
              { title: 'Private Rift IDs', desc: 'No directory lookup. Counterparties identified by secure IDs only — your identity stays yours.', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
              { title: 'Immutable audit trail', desc: 'Every action is logged. Transparent status updates, timestamped events, and complete deal history.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              { title: 'Encrypted vault', desc: 'AES-256 encrypted file storage with magic-byte scanning, hash verification, and view-only access controls.', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
              { title: 'Dispute resolution', desc: 'Structured issue submission with evidence packets, admin review path, and automated freeze controls.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            ].map((item, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-7 hover:border-white/[0.1] hover:bg-white/[0.025] transition-all duration-500"
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 rounded-xl p-3 bg-white/[0.04] text-white/50 group-hover:bg-emerald-400/10 group-hover:text-emerald-400 transition-all duration-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium text-lg mb-2 tracking-tight">{item.title}</div>
                    <div className="text-sm text-white/45 leading-relaxed font-light">{item.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── SOCIAL PROOF ───────── */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
        <div
          ref={social.ref}
          className={`transition-all duration-1000 ${social.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="relative rounded-3xl border border-white/[0.06] bg-white/[0.015] p-10 sm:p-14 md:p-16 text-center overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

            <svg className="mx-auto mb-8 w-10 h-10 text-emerald-400/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>

            <blockquote className="text-xl sm:text-2xl md:text-3xl font-light text-white/80 leading-relaxed mb-8 tracking-tight max-w-3xl mx-auto">
              Rift changed how we handle brand deals. No more chasing payments — funds are secured upfront and released when content is approved. Game changer.
            </blockquote>

            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 flex items-center justify-center text-sm font-medium text-white/70">
                J
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-white/70">Jamie R.</div>
                <div className="text-xs text-white/35 font-light">Content Creator • 500K+ Followers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 md:py-40">
        <div
          ref={cta.ref}
          className={`text-center transition-all duration-1000 ${cta.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-white leading-tight mb-6">
            Stop chasing payments.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              Start closing deals.
            </span>
          </h2>
          <p className="text-white/40 font-light text-base sm:text-lg max-w-xl mx-auto mb-10">
            Join thousands of creators and agencies securing their brand deals with Rift.
          </p>
          <Link
            href="/auth/signup"
            className="group inline-flex items-center gap-2 rounded-2xl bg-white px-10 py-4.5 text-[15px] font-semibold text-black hover:shadow-[0_0_60px_rgba(255,255,255,0.12)] transition-all duration-500"
          >
            Get Started Free
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <p className="mt-5 text-xs text-white/25 font-light">No credit card required • Free for your first deal</p>
        </div>
      </section>
    </div>
  )
}
