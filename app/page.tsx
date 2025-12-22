'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'

// Screenshot Gallery Component with Modal
function ScreenshotGallery() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const screenshots = [
    {
      id: 'dashboard',
      src: '/dashboard.png',
      title: 'Complete Dashboard',
      description: 'Track wallet balance, pending actions, recent activity, and all your rifts in one unified view',
      featured: true,
    },
    {
      id: 'create',
      src: '/rift-created.png',
      title: 'Create in Seconds',
      description: 'Start a protected transaction with our simple, intuitive creation flow. Choose your item type and get started instantly',
      featured: true,
    },
    {
      id: 'rifts',
      src: '/rifts.png',
      title: 'Manage All Rifts',
      description: 'View and manage all your active and completed transactions',
      featured: false,
    },
    {
      id: 'activity',
      src: '/recent-activity.png',
      title: 'Activity Tracking',
      description: 'Monitor all transaction activity and status updates in real-time',
      featured: false,
    },
  ]

  const featured = screenshots.filter(s => s.featured)
  const others = screenshots.filter(s => !s.featured)

  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedImage])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImage(null)
      }
    }
    if (selectedImage) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [selectedImage])

  return (
    <>
      {/* Featured Screenshots - Full Width, Large */}
      <div className="space-y-12 mb-16">
        {featured.map((screenshot, index) => (
          <div
            key={screenshot.id}
            className={`group relative ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700`}
            style={{ transitionDelay: `${index * 150}ms` }}
          >
            <GlassCard variant="glass" className="p-6 lg:p-8 overflow-visible hover:border-white/20 transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-3xl lg:text-4xl font-light text-white mb-3">{screenshot.title}</h3>
                <p className="text-base text-white/60 font-light max-w-2xl">
                  {screenshot.description}
                </p>
              </div>
              <div 
                className="relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer group/image"
                onClick={() => setSelectedImage(screenshot.src)}
              >
                <Image 
                  src={screenshot.src} 
                  alt={screenshot.title} 
                  width={1200}
                  height={800}
                  className="w-full h-auto object-contain transition-transform duration-500 group-hover/image:scale-[1.02]"
                  style={{ maxHeight: '70vh', minHeight: 'clamp(300px, 50vh, 500px)' }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                  priority={screenshot.featured}
                />
              </div>
            </GlassCard>
          </div>
        ))}
      </div>

      {/* Secondary Screenshots - Side by Side */}
      <div className="grid md:grid-cols-2 gap-8">
        {others.map((screenshot, index) => (
          <div
            key={screenshot.id}
            className={`group relative ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700`}
            style={{ transitionDelay: `${(featured.length + index) * 150}ms` }}
          >
            <GlassCard variant="glass" className="p-6 overflow-visible hover:border-white/20 transition-all duration-300">
              <div className="mb-5">
                <h3 className="text-2xl font-light text-white mb-2">{screenshot.title}</h3>
                <p className="text-sm text-white/60 font-light">
                  {screenshot.description}
                </p>
              </div>
              <div 
                className="relative rounded-xl overflow-hidden shadow-xl cursor-pointer group/image"
                onClick={() => setSelectedImage(screenshot.src)}
              >
                <Image 
                  src={screenshot.src} 
                  alt={screenshot.title} 
                  width={800}
                  height={600}
                  className="w-full h-auto object-contain transition-transform duration-500 group-hover/image:scale-[1.02]"
                  style={{ maxHeight: '50vh', minHeight: 'clamp(250px, 40vh, 400px)' }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 800px"
                />
              </div>
            </GlassCard>
          </div>
        ))}
      </div>

      {/* Modal Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 hover:scale-110"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative max-w-[95vw] max-h-[95vh] w-full h-full flex items-center justify-center">
            {selectedImage && (
              <Image 
                src={selectedImage} 
                alt="Full size screenshot"
                width={1920}
                height={1080}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300"
                onClick={(e) => e.stopPropagation()}
                sizes="95vw"
              />
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
            Press ESC or click outside to close
          </div>
        </div>
      )}
    </>
  )
}

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

  // Redirect authenticated users
  if (status === 'authenticated') {
    return null
  }

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-8 sm:pb-12 lg:pt-28 lg:pb-16">
        <div className="relative z-10">
          {/* Trust Badge */}
          <div className={`flex justify-center mb-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] backdrop-blur-xl border border-white/8 hover:border-white/15 transition-all duration-300 group">
              <svg className="w-3.5 h-3.5 text-green-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white/70 font-light text-xs tracking-wide">Trusted by thousands worldwide</span>
            </div>
          </div>
          
          {/* Main Heading */}
          <div className={`text-center mb-6 sm:mb-8 transition-all duration-1000 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light mb-4 sm:mb-6 leading-[1.1] tracking-[-0.03em] px-2">
              <span className="block text-white/95 mb-2 sm:mb-3 font-light">The Safest Way to</span>
              <span className="block text-white font-light">
                Buy & Sell Online
              </span>
            </h1>
          </div>
          
          {/* Subheading */}
          <div className={`text-center mb-8 sm:mb-10 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-xl sm:text-2xl md:text-3xl text-white/90 font-light mb-3 sm:mb-4 max-w-2xl mx-auto leading-relaxed px-4">
              Never get scammed again.
            </p>
            <p className="text-sm sm:text-base md:text-lg text-white/60 max-w-xl mx-auto leading-relaxed font-light px-4">
              Rift protects your money until the job is done — and verifies every buyer & seller.
            </p>
          </div>
          
          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-8 sm:mb-12 px-4 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <Link href="/auth/signup" className="group relative w-full sm:w-auto">
              <PremiumButton 
                size="lg" 
                variant="primary" 
                className="w-full sm:w-auto min-w-[200px] text-base px-8 sm:px-10 py-4 font-semibold shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-all duration-300"
              >
                <span className="flex items-center justify-center gap-2">
                  <span>Start a Rift</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </PremiumButton>
            </Link>
            <Link href="#how-it-works" className="group w-full sm:w-auto">
              <PremiumButton 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto min-w-[200px] text-base px-8 sm:px-10 py-4 font-medium bg-transparent !border !border-white text-white hover:bg-white/5 hover:!border-white transition-all duration-300 rounded-full"
                style={{ borderColor: 'white' }}
              >
                How Rift Works
              </PremiumButton>
            </Link>
          </div>

          {/* Security Features */}
          <div className={`flex flex-wrap justify-center gap-6 transition-all duration-1000 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center gap-2 text-white/50 text-sm font-light">
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure Protection</span>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-sm font-light">
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Verified Users</span>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-sm font-light">
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Dispute Resolution</span>
            </div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '120px 120px',
          }} />
        </div>
      </section>

      {/* Why People Get Scammed Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight px-2">
            The Problem We Solve
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-light px-4">
            Online transactions are vulnerable. Here's how we protect you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {[
            {
              problem: 'Fake Sellers',
              problemDesc: 'Scammers create fake profiles and disappear after payment',
              solution: 'Rift verifies every seller\'s identity before they can receive funds',
            },
            {
              problem: 'Fake Proof of Payment',
              problemDesc: 'Screenshots of fake transactions trick buyers',
              solution: 'Rift handles all payments directly — no screenshots needed',
            },
            {
              problem: 'Lost Money, No Recourse',
              problemDesc: 'Once money is sent, it\'s gone forever',
              solution: 'Dispute system with admin review — get your money back',
            }
          ].map((item, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover
              className="p-6 sm:p-8 relative transition-all duration-300 group flex flex-col"
            >
              <div className="relative z-10 flex flex-col">
                {/* Problem */}
                <div className="mb-6 sm:mb-8 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400/60 flex-shrink-0" />
                    <h3 className="text-base sm:text-lg font-light text-white leading-tight">{item.problem}</h3>
                  </div>
                  <p className="text-sm sm:text-base text-white/50 font-light leading-relaxed pl-5">
                    {item.problemDesc}
                  </p>
                </div>

                {/* Solution */}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400/60 flex-shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm sm:text-base text-white/80 font-light leading-relaxed">
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Visual Transaction Flow */}
      <section id="how-it-works" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight px-2">
            How It Works
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-light px-4">
            Simple, secure, and built for trust. Here's the complete flow.
          </p>
        </div>

        {/* Premium Combined Payment Flow Section */}
        <div className="relative max-w-7xl mx-auto">
          {/* Desktop Layout */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-5 gap-6 items-stretch">
              {[
                {
                  num: '1',
                  title: 'Buyer Sends Payment',
                  subtitle: 'Buyer pays securely',
                  desc: 'Using credit card, Apple Pay, or Google Pay. Payment is processed securely and funds are immediately held by Rift until completion.',
                  icon: (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  badge: 'Protected',
                  badgeIcon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ),
                  iconBg: 'from-blue-500/20 to-cyan-500/10',
                  iconBorder: 'border-blue-500/30'
                },
                {
                  num: '2',
                  title: 'Rift Holds Funds',
                  subtitle: 'Rift holds funds until completion',
                  desc: 'Money is locked away safely. Seller sees the payment but cannot access funds yet.',
                  icon: (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ),
                  badge: 'Secure',
                  badgeIcon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                  iconBg: 'from-purple-500/20 to-indigo-500/10',
                  iconBorder: 'border-purple-500/30'
                },
                {
                  num: '3',
                  title: 'Seller Delivers',
                  subtitle: 'Seller delivers item/service',
                  desc: 'Sellers mark items as delivered. For digital items and tickets: provide access. For services: confirm completion.',
                  icon: (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ),
                  badge: 'Verified',
                  badgeIcon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  iconBg: 'from-green-500/20 to-emerald-500/10',
                  iconBorder: 'border-green-500/30'
                },
                {
                  num: '4',
                  title: 'Buyer Confirms',
                  subtitle: 'Buyer confirms receipt',
                  desc: 'Buyer confirms receipt. For digital items, tickets, and services: instant payout after confirmation.',
                  icon: (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  badge: 'Trusted',
                  badgeIcon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ),
                  iconBg: 'from-yellow-500/20 to-amber-500/10',
                  iconBorder: 'border-yellow-500/30'
                },
                {
                  num: '5',
                  title: 'Funds Released',
                  subtitle: 'Funds released to seller wallet',
                  desc: 'After confirmation or auto-release. Seller receives amount minus 5% platform fee. Funds instantly available in wallet. Bank payout scheduled based on risk tier (1-5 business days).',
                  icon: (
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  ),
                  badge: 'Complete',
                  badgeIcon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  iconBg: 'from-emerald-500/20 to-teal-500/10',
                  iconBorder: 'border-emerald-500/30'
                }
              ].map((item, index) => (
                <div key={index} className="flex flex-col">
                  <GlassCard 
                    variant="glass" 
                    hover
                    className={`p-8 h-full relative transition-all duration-500 group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="relative z-10">
                      {/* Number Badge */}
                      <div className="flex items-center justify-between mb-6">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.iconBg} border ${item.iconBorder} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-light text-xl">{item.num}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 glass px-3 py-1.5 rounded-full text-xs text-white/80 font-light border border-white/10">
                          {item.badgeIcon}
                          <span>{item.badge}</span>
                        </div>
                      </div>
                      
                      {/* Icon */}
                      <div className="flex justify-center mb-6 text-white/90 group-hover:scale-110 transition-transform duration-300">
                        {item.icon}
                      </div>
                      
                      {/* Content */}
                      <h3 className="text-xl font-light text-white mb-3 leading-tight text-center">{item.title}</h3>
                      <p className="text-sm text-white/60 font-light leading-relaxed text-center mb-4">{item.subtitle}</p>
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-xs text-white/50 font-light leading-relaxed text-center">{item.desc}</p>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden space-y-6">
            {[
              {
                num: '1',
                title: 'Buyer Sends Payment',
                subtitle: 'Buyer pays securely',
                desc: 'Using credit card, Apple Pay, or Google Pay. Payment is processed securely and funds are immediately held in rift.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                badge: 'Protected',
                badgeIcon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                iconBg: 'from-blue-500/20 to-cyan-500/10',
                iconBorder: 'border-blue-500/30'
              },
              {
                num: '2',
                title: 'Rift Holds Funds',
                subtitle: 'Rift holds funds in rift',
                desc: 'Money is locked away safely. Seller sees the payment but cannot access funds yet.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                badge: 'Secure',
                badgeIcon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                iconBg: 'from-purple-500/20 to-indigo-500/10',
                iconBorder: 'border-purple-500/30'
              },
              {
                num: '3',
                title: 'Seller Delivers',
                subtitle: 'Seller delivers item/service',
                desc: 'Sellers mark items as delivered. For digital items and tickets: provide access. For services: confirm completion.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ),
                badge: 'Verified',
                badgeIcon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                iconBg: 'from-green-500/20 to-emerald-500/10',
                iconBorder: 'border-green-500/30'
              },
              {
                num: '4',
                title: 'Buyer Confirms',
                subtitle: 'Buyer confirms receipt',
                desc: 'Buyer confirms receipt. For digital items, tickets, and services: instant payout after confirmation.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                badge: 'Trusted',
                badgeIcon: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ),
                iconBg: 'from-yellow-500/20 to-amber-500/10',
                iconBorder: 'border-yellow-500/30'
              },
                {
                  num: '5',
                  title: 'Funds Released',
                  subtitle: 'Funds released to seller wallet',
                  desc: 'After confirmation or auto-release. Seller receives amount minus 5% platform fee. Funds instantly available in wallet. Bank payout scheduled based on risk tier (1-5 business days).',
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  ),
                  badge: 'Complete',
                  badgeIcon: (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  iconBg: 'from-emerald-500/20 to-teal-500/10',
                  iconBorder: 'border-emerald-500/30'
                }
            ].map((item, index) => (
              <div key={index}>
                <GlassCard 
                  variant="glass" 
                  hover
                  className={`p-8 relative transition-all duration-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="relative z-10">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.iconBg} border ${item.iconBorder} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-light text-xl">{item.num}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-light text-white">{item.title}</h3>
                          <div className="inline-flex items-center gap-1.5 glass px-3 py-1 rounded-full text-xs text-white/80 font-light border border-white/10">
                            {item.badgeIcon}
                            <span>{item.badge}</span>
                          </div>
                        </div>
                        <p className="text-sm text-white/70 font-light mb-3">{item.subtitle}</p>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-white/60">
                            {item.icon}
                          </div>
                        </div>
                        <p className="text-xs text-white/50 font-light leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Showcase */}
      <section className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white mb-6 tracking-tight">
            Your Command Center
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto font-light">
            Everything you need to manage protected transactions, all in one place
          </p>
        </div>

        {/* Screenshot Gallery with Modal */}
        <ScreenshotGallery />
      </section>

      {/* Protection Features Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight">
            Protection Tailored to Every Item Type
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-light px-4">
            Different items need different protection. We've got you covered.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {[
            {
              type: 'Digital Products',
              features: ['Instant payouts', '24-hour buyer protection', 'Auto-release after seller confirms', 'Download verification'],
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
              highlight: 'Fast & Secure'
            },
            {
              type: 'Tickets',
              features: ['Instant payouts', '24-hour buyer protection', 'Transfer verification', 'Auto-release system'],
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              ),
              highlight: 'Instant Delivery'
            },
            {
              type: 'Services',
              features: ['Instant payouts', '24-hour buyer protection', 'Service completion tracking', 'Quick resolution'],
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
              highlight: 'Fast Payouts'
            }
          ].map((item, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover
              className={`p-8 lg:p-10 relative transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6 lg:mb-8">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-white/90 flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-base lg:text-lg font-light text-white">{item.type}</h3>
                    <div className="text-xs text-green-400/80 font-light mt-1">{item.highlight}</div>
                  </div>
                </div>
                <ul className="space-y-2.5 lg:space-y-3">
                  {item.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-white/70 font-light text-sm lg:text-base">
                      <svg className="w-4 h-4 text-green-400/80 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Security & Trust Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight">
            Bank-Level Security
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-light px-4">
            Your data and money are protected with enterprise-grade security
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: 'Payment Processing Security',
              description: 'All payments are processed through secure, encrypted channels. Your card details are never stored on our servers.',
              icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )
            },
            {
              title: 'Buyer Protection',
              description: 'Funds are held securely by Rift until both parties confirm the transaction is complete.',
              icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )
            },
            {
              title: 'Data Encryption',
              description: 'All sensitive data is encrypted at rest and in transit using industry-standard encryption protocols.',
              icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )
            }
          ].map((item, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover
              className={`p-10 relative transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-white/90 mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl font-light text-white mb-4">{item.title}</h3>
                <p className="text-white/70 font-light text-sm leading-relaxed">{item.description}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Real Stories Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight">
            Real Stories
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto font-light">
            See how Rift changed the way people buy and sell online
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              quote: 'I used to get scammed on Facebook Marketplace. Rift changed everything.',
              author: 'Alex M.',
              role: 'Buyer & Seller',
              avatar: 'A'
            },
            {
              quote: 'I sell digital products and services with complete confidence.',
              author: 'Jessica K.',
              role: 'Freelancer',
              avatar: 'J'
            },
            {
              quote: 'I no longer accept e-transfer. Rift only.',
              author: 'David R.',
              role: 'Small Business Owner',
              avatar: 'D'
            }
          ].map((story, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover
              className={`p-6 sm:p-8 lg:p-10 relative transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="relative z-10">
                <div className="text-3xl sm:text-4xl mb-4 sm:mb-6 text-white/20 font-serif">"</div>
                <p className="text-white/90 font-light leading-relaxed mb-6 sm:mb-8 text-sm sm:text-base">
                  {story.quote}
                </p>
                <div className="flex items-center gap-4 pt-4 sm:pt-6 border-t border-white/10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-white/20 to-white/10 border border-white/20 flex items-center justify-center text-white/90 font-light text-base sm:text-lg">
                    {story.avatar}
                  </div>
                  <div>
                    <p className="text-white font-light text-xs sm:text-sm">{story.author}</p>
                    <p className="text-white/50 font-light text-xs mt-0.5">{story.role}</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight">
            Perfect For These Scenarios
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-light px-4">
            Use Rift wherever you need secure, protected transactions
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {[
            {
              useCase: 'Facebook Marketplace & Social Media',
              description: 'Selling tickets, digital products, or services on Facebook Marketplace or Instagram? Protect yourself from fake payment screenshots and chargebacks. Rift ensures you get paid securely.',
              icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )
            },
            {
              useCase: 'Buying Tickets from Strangers',
              description: 'Purchase concert tickets, event passes, or vouchers with confidence. Instant payouts mean sellers get paid quickly, while you verify the tickets work.',
              icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              )
            },
            {
              useCase: 'Freelance & Service Payments',
              description: 'Hiring someone for a service? Pay securely and release funds only when the work is complete. Sellers get instant payouts for digital services.',
              icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )
            }
          ].map((item, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover
              className={`p-6 sm:p-8 lg:p-10 relative transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-4 sm:mb-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-white/90 flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg lg:text-xl font-light text-white mb-3">{item.useCase}</h3>
                    <p className="text-white/70 font-light text-sm sm:text-base leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Payment Methods Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white mb-6 tracking-tight">
            Multiple Payment Methods
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto font-light">
            Secure payment processing with all the methods you trust
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              method: 'Credit & Debit Cards',
              description: 'Visa, Mastercard, American Express',
              icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )
            },
            {
              method: 'Apple Pay',
              description: 'Quick and secure on iOS devices',
              icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )
            },
            {
              method: 'Google Pay',
              description: 'Fast checkout on Android',
              icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )
            },
            {
              method: 'Secure Processing',
              description: 'Bank-level encryption & fraud protection',
              icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )
            }
          ].map((item, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover
              className={`p-10 relative transition-all duration-500 group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className="relative z-10 text-center">
                <div className="flex justify-center mb-5 text-white/90 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h3 className="text-lg font-light text-white mb-3">{item.method}</h3>
                <p className="text-white/60 font-light text-sm leading-relaxed">{item.description}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Mobile App Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <GlassCard variant="glass" className="p-12 md:p-20 relative">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white mb-8 tracking-tight">
                Take Rift With You
              </h2>
              <p className="text-xl text-white/80 mb-8 font-light leading-relaxed">
                Manage transactions on-the-go with our mobile app. Get instant notifications, track your transactions in real-time, and complete deals from anywhere.
              </p>
              <ul className="space-y-5 mb-10">
                {[
                  'Real-time transaction updates',
                  'Push notifications for status changes',
                  'Secure mobile payments',
                  'Easy dispute filing',
                  'Quick access to your balance'
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-4 text-white/90 font-light">
                    <div className="w-6 h-6 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-base">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup">
                <PremiumButton variant="outline" className="w-full sm:w-auto px-10 py-4 bg-white/5 border-white/20 text-white hover:bg-white/10">
                  Coming Soon
                </PremiumButton>
              </Link>
            </div>
            <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`} style={{ transitionDelay: '200ms' }}>
              <div className="aspect-[9/16] max-w-xs mx-auto glass rounded-[2.5rem] p-6 flex items-center justify-center border border-white/10">
                <svg className="w-32 h-32 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* FAQ */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white mb-4 sm:mb-6 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {[
            {
              question: 'What payment methods do you accept?',
              answer: 'We accept credit and debit cards (Visa, Mastercard, American Express), Apple Pay, and Google Pay. All payments are processed securely through encrypted channels.'
            },
            {
              question: 'How does buyer protection work?',
              answer: 'When a buyer pays, Rift holds the funds securely until completion. The seller can see the payment but cannot access the money until you confirm receipt (or after a protection period). This protects both parties from scams.'
            },
            {
              question: 'How does protection work for different item types?',
              answer: 'Digital items, tickets, and services get instant payouts when the seller marks delivered, with a 24-hour buyer protection window. Buyers can raise disputes during this period if there are any issues.'
            },
            {
              question: 'What\'s the difference between Rift and PayPal/Venmo?',
              answer: 'Unlike PayPal or Venmo, Rift holds funds securely until both parties confirm completion. This prevents chargebacks, fake payment screenshots, and "item not received" scams. Funds are only released when the transaction is verified complete.'
            },
            {
              question: 'How long does it take to receive funds?',
              answer: 'For digital items, tickets, and services: instant payout after seller confirms delivery and buyer confirms receipt (with 24-hour buyer protection window for disputes).'
            },
            {
              question: 'What happens if I dispute a transaction?',
              answer: 'You can raise a dispute at any time before funds are released. Our admin team reviews all evidence (messages, photos, tracking info) and makes a fair decision. Disputes are typically resolved within 24-48 hours.'
            },
            {
              question: 'What are the fees?',
              answer: 'Buyers pay a 3% payment processing fee (covers card network and processing costs). Sellers pay a 5% platform fee. All fees are clearly displayed before any transaction. No hidden charges.'
            },
            {
              question: 'Is my information secure?',
              answer: 'Absolutely. We use bank-level encryption for all data in transit and at rest. Your card details are never stored on our servers — they\'re processed securely through our payment processor. We never share your financial information with third parties.'
            }
          ].map((faq, index) => (
            <GlassCard 
              key={index} 
              variant="glass" 
              hover 
              className={`p-6 sm:p-8 lg:p-10 cursor-pointer relative transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className="relative z-10">
                <h3 className="text-lg sm:text-xl font-light text-white mb-3 sm:mb-4">{faq.question}</h3>
                <p className="text-white/70 font-light leading-relaxed text-sm sm:text-base">{faq.answer}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

    </div>
  )
}
