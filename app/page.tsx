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
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Swipe detection
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goToNext()
    }
    if (isRightSwipe) {
      goToPrevious()
    }
  }

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % 5)
  }

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + 5) % 5)
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

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
        <section className="mx-auto max-w-6xl px-6 pt-40 pb-64">
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
              Create a Rift, secure payment, verify delivery, and release funds.
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

        {/* Interface Showcase */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                Interface
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight leading-tight">
              Powerful <span className="text-emerald-400/40">interface</span>
            </h2>
            <p className="text-white/60 font-light text-base max-w-2xl mx-auto leading-relaxed">
              A clean, intuitive interface designed for managing transactions with ease
            </p>
          </div>

          {/* Carousel */}
          <div className="relative max-w-5xl mx-auto">
            {/* Navigation Buttons - Outside */}
            <button
              onClick={goToPrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 z-10 w-12 h-12 rounded-full glass-soft border border-white/10 hover:border-emerald-400/30 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-all duration-300 hover:scale-110 group hidden md:flex"
              aria-label="Previous slide"
            >
              <svg className="w-6 h-6 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 z-10 w-12 h-12 rounded-full glass-soft border border-white/10 hover:border-emerald-400/30 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-all duration-300 hover:scale-110 group hidden md:flex"
              aria-label="Next slide"
            >
              <svg className="w-6 h-6 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Screenshot Items */}
            <div 
              className="relative overflow-hidden rounded-2xl glass-soft border border-white/5"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {[
                  {
                    title: 'Dashboard',
                    image: '/dashboard.png'
                  },
                  {
                    title: 'Your Rifts',
                    image: '/rifts.png'
                  },
                  {
                    title: 'Rift Details',
                    image: '/rift-view.png'
                  },
                  {
                    title: 'Messages',
                    image: '/messages.png'
                  },
                  {
                    title: 'Activity',
                    image: '/recent-activity.png'
                  }
                ].map((item, index) => {
                  return (
                    <div 
                      key={index}
                      className="w-full flex-shrink-0"
                    >
                      {/* Image Container */}
                      <div className="relative aspect-video bg-black overflow-hidden">
                        <img 
                          src={item.image} 
                          alt={`${item.title} interface`}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Navigation Buttons - Inside for smaller screens */}
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full glass-soft border border-white/10 hover:border-emerald-400/30 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-all duration-300 hover:scale-110 group md:hidden"
              aria-label="Previous slide"
            >
              <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full glass-soft border border-white/10 hover:border-emerald-400/30 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white transition-all duration-300 hover:scale-110 group md:hidden"
              aria-label="Next slide"
            >
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Indicators/Dots */}
            <div className="flex items-center justify-center gap-2 mt-8">
              {[0, 1, 2, 3, 4].map((index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all duration-300 rounded-full ${
                    currentSlide === index
                      ? 'w-8 h-2 bg-emerald-400'
                      : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Demo */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                Demo
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight leading-tight">
              See it in <span className="text-emerald-400/40">action</span>
            </h2>
            <p className="text-white/60 font-light text-base max-w-2xl mx-auto leading-relaxed">
              Interactive walkthrough of a Rift transaction
            </p>
          </div>
          <div className="opacity-90">
            <InteractiveDemo />
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
          <div className="mb-24 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                Process
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
        </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight leading-tight">
              How it <span className="text-emerald-400/40">works</span>
          </h2>
            <p className="text-white/60 font-light text-base max-w-2xl mx-auto leading-relaxed">
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

        {/* Use Cases */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="mb-24 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                Use Cases
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight leading-tight">
              Built for every <span className="text-emerald-400/40">deal</span>
            </h2>
            <p className="text-white/60 font-light text-base max-w-2xl mx-auto leading-relaxed">
              Secure transactions across digital goods, ownership transfers, and services
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                title: 'Digital Goods',
                description: 'Software, licenses, downloads, and digital assets',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )
              },
              {
                title: 'Ownership Transfer',
                description: 'Assets that require verified transfer with confirmation and protection.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                )
              },
              {
                title: 'Services',
                description: 'Consulting, freelance work, and milestone-based deliverables',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )
                }
            ].map((item, index) => (
              <div 
              key={index} 
                className="group relative transition-all duration-300 rounded-2xl glass-soft p-6 md:p-8 border border-white/5 hover:border-emerald-400/30 hover:bg-white/[0.025] hover:shadow-lg hover:shadow-emerald-400/10 hover:scale-[1.02]"
              >
                {/* Icon */}
                <div className="mb-4 inline-flex items-center justify-center rounded-xl p-3 transition-colors bg-white/5 text-white/60 group-hover:bg-emerald-400/10 group-hover:text-emerald-400">
                  {item.icon}
                </div>
                
                <div className="font-medium text-lg mb-3 transition-colors text-white/90 group-hover:text-white">
                  {item.title}
        </div>
                <div className="leading-relaxed transition-colors text-sm text-white/55 group-hover:text-white/70">
                  {item.description}
                </div>
              </div>
          ))}
        </div>
      </section>

        {/* Trust Layer Features */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="mb-24 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                Features
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-medium text-white mb-6 tracking-tight leading-tight">
              Trust layer <span className="text-emerald-400/40">features</span>
          </h2>
            <p className="text-white/60 font-light text-base max-w-2xl mx-auto leading-relaxed">
              Built-in security, transparency, and control for every transaction
          </p>
        </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
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
                title: 'Audit trail',
                description: 'Complete activity log with transparent status updates.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )
            },
            {
                title: 'Vault submissions',
                description: 'Secure proof storage with verification window and access controls.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )
            },
            {
                title: 'Resolution controls',
                description: 'Clear rules, structured issue submission, and admin review path.',
              icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )
            }
          ].map((item, index) => (
              <div 
              key={index} 
                className="group rounded-2xl glass-soft p-6 border border-white/5 hover:border-white/10 hover:bg-white/[0.025] transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 inline-flex items-center justify-center rounded-xl p-3 bg-white/5 text-white/60 group-hover:bg-emerald-400/10 group-hover:text-emerald-400/60 transition-all duration-300">
                    {item.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="text-white font-medium text-lg mb-2 group-hover:text-emerald-400/30 transition-colors">
                      {item.title}
                    </div>
                    <div className="text-sm text-white/60 leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                </div>
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
