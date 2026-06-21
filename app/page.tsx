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
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-24 sm:pt-32 md:pt-40 pb-16 sm:pb-24">
        <div className={`mx-auto max-w-4xl text-center transition-all duration-[1200ms] ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs tracking-wide text-[#86868b] mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            TRUSTED BY BRANDS & CREATORS
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[72px] font-semibold tracking-[-0.04em] text-[#1d1d1f] leading-[1.05]">
            UGC content,<br />
            <span className="text-[#86868b]">managed end-to-end.</span>
          </h1>

          <p className="mx-auto mt-6 sm:mt-8 max-w-2xl text-lg sm:text-xl text-[#86868b] leading-relaxed font-light">
            Rift is a UGC agency platform. Brands submit campaign briefs and pay upfront. We match creators, review every video, and deliver finished content — with zero direct brand↔creator contact.
          </p>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="group w-full sm:w-auto rounded-full bg-[#1d1d1f] px-8 py-4 text-[15px] font-semibold text-white hover:bg-white transition-all duration-300 flex items-center justify-center gap-2"
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
            { value: 500, suffix: '+', label: 'Videos delivered' },
            { value: 120, suffix: '+', label: 'Brand campaigns' },
            { value: 48, suffix: 'hr', label: 'Avg. turnaround' },
            { value: 4, suffix: '.9', label: 'Brand satisfaction' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={'prefix' in stat ? stat.prefix : ''} />
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
              How Rift works.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-4">
            {[
              { num: '01', title: 'Brief', desc: 'Brand submits product, talking points, format & deadline', icon: 'M12 4v16m8-8H4' },
              { num: '02', title: 'Pay', desc: 'Campaign budget secured upfront via Stripe', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
              { num: '03', title: 'Create', desc: 'Creators get a sanitized brief — no brand info', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
              { num: '04', title: 'Review', desc: 'Rift approves content or requests revisions', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { num: '05', title: 'Deliver', desc: 'Brand receives final videos in their portal', icon: 'M13 7l5 5m0 0l-5 5m5-5H6' },
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
                Built for UGC at scale.
              </h2>
              <p className="mt-4 text-[#86868b] text-lg max-w-2xl mx-auto">One agency layer between brands and creators — you stay in control, they stay anonymous.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: 'For Brands', desc: 'Submit briefs, pay upfront, and download approved UGC from your campaign portal. Never manage creators directly.', metric: 'Campaign dashboard', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75H21m-3.75 0H21' },
                { title: 'For Creators', desc: 'Receive sanitized briefs, upload videos, get paid a flat rate per approved video. Brand identity never revealed.', metric: 'Flat-rate payouts', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                { title: 'For Agencies', desc: 'Assign creators internally, review uploads, request revisions, and trigger payouts — all from one admin panel.', metric: 'Full workflow control', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
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
              Agency-grade workflow.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Blind matching', desc: 'Creators never see brand names. Brands never contact creators. Rift is the only bridge.', icon: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' },
              { title: 'Milestone tracking', desc: 'Every campaign moves through clear stages — brief, assignment, upload, review, delivery.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              { title: 'Secure payments', desc: 'Brands pay campaign budgets upfront via Stripe. Creators receive flat-rate payouts after approval.', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
              { title: 'Managed messaging', desc: 'Brand↔Rift and creator↔Rift communication only. No direct messages between parties.', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
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
              "We switched to Rift for all our UGC. Submit a brief, pay once, get videos back — no creator management overhead."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-cyan-100 flex items-center justify-center text-sm font-semibold text-emerald-700">S</div>
              <div className="text-left">
                <div className="text-sm font-semibold text-[#1d1d1f]">Sarah K.</div>
                <div className="text-xs text-[#86868b]">DTC Brand Manager</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 md:py-40">
        <div ref={cta.ref} className={`text-center transition-all duration-1000 ${cta.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#1d1d1f] leading-tight mb-6">
            Launch your next<br />
            <span className="text-[#86868b]">UGC campaign.</span>
          </h2>
          <p className="text-[#86868b] text-lg max-w-xl mx-auto mb-10">
            Brands submit briefs. Creators deliver content. Rift handles everything in between.
          </p>
          <Link href="/auth/signup" className="group inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-10 py-4.5 text-[15px] font-semibold text-white hover:bg-white transition-all duration-300">
            Get Started Free
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <p className="mt-5 text-xs text-[#86868b]">No credit card required to sign up</p>
        </div>
      </section>
    </div>
  )
}
