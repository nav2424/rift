'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

function SupportContent() {
  const searchParams = useSearchParams()
  const type = searchParams?.get('type') || 'faq'

  const getIcon = () => {
    switch (type) {
      case 'faq':
        return (
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'contact':
        return (
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'report':
        return (
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      default:
        return null
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'faq':
        return 'Frequently Asked Questions'
      case 'contact':
        return 'Contact Support'
      case 'report':
        return 'Report a Problem'
      default:
        return 'Support & Help Center'
    }
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

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-8">
          <Link 
            href="/account"
            className="text-white/60 hover:text-white/90 font-light mb-6 transition-colors flex items-center gap-2 inline-block"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Account
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20">
              {getIcon()}
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tight">
                {getTitle()}
              </h1>
              <p className="text-white/60 font-light">Get help and answers</p>
            </div>
          </div>
        </div>

        <GlassCard>
          <div className="p-6">
            {type === 'faq' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-white font-light text-lg mb-3">How does Rift protect my transactions?</h3>
                  <p className="text-white/60 font-light text-sm leading-relaxed">
                    Rift holds funds in escrow until both parties confirm the transaction is complete. 
                    For physical items, we verify tracking and provide a grace period. For digital items 
                    and services, we use instant release systems with buyer protection.
                  </p>
                </div>

                <div>
                  <h3 className="text-white font-light text-lg mb-3">What fees does Rift charge?</h3>
                  <p className="text-white/60 font-light text-sm leading-relaxed">
                    <strong>Buyers pay 0%</strong> - You pay exactly the listed price with no added fees. 
                    <strong>Sellers pay 8% total</strong> - A flat fee that includes both the platform fee and payment 
                    processing fees (Stripe). No additional fees. Simple and transparent.
                  </p>
                </div>

                <div>
                  <h3 className="text-white font-light text-lg mb-3">How do I resolve a dispute?</h3>
                  <p className="text-white/60 font-light text-sm leading-relaxed">
                    If you have an issue with a transaction, you can raise a dispute from the transaction 
                    detail page. Our admin team will review the dispute and work to resolve it fairly.
                  </p>
                </div>

                <div>
                  <h3 className="text-white font-light text-lg mb-3">How long does it take to receive funds?</h3>
                  <p className="text-white/60 font-light text-sm leading-relaxed">
                    Once the buyer confirms receipt or the auto-release period expires, funds are typically 
                    released immediately. For physical items, there's a 48-hour grace period after delivery 
                    confirmation.
                  </p>
                </div>
              </div>
            )}

            {type === 'contact' && (
              <div className="space-y-6">
                <p className="text-white/60 font-light leading-relaxed">
                  Need help? Contact our support team at{' '}
                  <a href="mailto:support@rift.com" className="text-white hover:underline">
                    support@rift.com
                  </a>
                </p>

                <p className="text-white/60 font-light leading-relaxed">
                  We typically respond within 24 hours during business days.
                </p>
              </div>
            )}

            {type === 'report' && (
              <div className="space-y-6">
                <p className="text-white/60 font-light leading-relaxed">
                  If you've encountered a bug, issue, or have a feature request, please email us at{' '}
                  <a href="mailto:report@rift.com" className="text-white hover:underline">
                    report@rift.com
                  </a>
                </p>

                <p className="text-white/60 font-light leading-relaxed">
                  Please include as much detail as possible, including screenshots if applicable.
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    }>
      <SupportContent />
    </Suspense>
  )
}
