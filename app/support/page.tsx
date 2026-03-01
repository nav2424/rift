'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import GlassCard from '@/components/ui/GlassCard'

function SupportContent() {
  const searchParams = useSearchParams()
  const type = searchParams?.get('type') || 'faq'
  const [openFaq, setOpenFaq] = useState<number | null>(0) // First FAQ open by default

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

  const getColor = () => {
    switch (type) {
      case 'faq':
        return 'blue'
      case 'contact':
        return 'purple'
      case 'report':
        return 'red'
      default:
        return 'blue'
    }
  }

  const color = getColor()
  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20',
      iconBg: 'from-blue-500/20 to-blue-500/10',
      iconBorder: 'border-blue-500/20',
      iconText: 'text-blue-400',
      button: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 hover:from-blue-500/20 hover:to-blue-500/10'
    },
    purple: {
      bg: 'bg-purple-500/5',
      border: 'border-purple-500/20',
      iconBg: 'from-purple-500/20 to-purple-500/10',
      iconBorder: 'border-purple-500/20',
      iconText: 'text-purple-400',
      button: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:border-purple-500/40 hover:from-purple-500/20 hover:to-purple-500/10'
    },
    red: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/20',
      iconBg: 'from-red-500/20 to-red-500/10',
      iconBorder: 'border-red-500/20',
      iconText: 'text-red-400',
      button: 'from-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/40 hover:from-red-500/20 hover:to-red-500/10'
    }
  }

  const colors = colorClasses[color as keyof typeof colorClasses]

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-gray-50 rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.iconBg} border ${colors.iconBorder} flex items-center justify-center flex-shrink-0 mt-1`}>
              {getIcon()}
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] mb-2 tracking-tight">
                {getTitle()}
              </h1>
              <p className="text-[#86868b] font-light">Get help and answers</p>
            </div>
          </div>
        </div>

        <GlassCard variant="liquid" className={`relative overflow-hidden group ${colors.bg}`}>
          <div className={`absolute top-0 right-0 w-64 h-64 ${colors.bg} rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity`} />
          <div className="relative z-10 p-6">
            {type === 'faq' && (
              <div className="space-y-0">
                {[
                  {
                    question: 'How does Rift protect my transactions?',
                    answer: 'Rift holds funds securely until both parties confirm the transaction is complete. We provide secure communication channels, transaction tracking, and conditional fund release mechanisms to ensure both buyers and sellers are protected throughout the process.'
                  },
                  {
                    question: 'What fees does Rift charge?',
                    answer: 'Buyers pay 3% - A small processing fee that covers card network and payment processing costs. Sellers pay 5% - A platform fee that includes complete protection, dispute resolution, and support. No additional fees. Simple and transparent.'
                  },
                  {
                    question: 'How do I resolve a dispute?',
                    answer: 'If you have an issue with a transaction, you can raise a dispute from the transaction detail page. Our admin team will review the dispute and work to resolve it fairly.'
                  },
                  {
                    question: 'How long does it take to receive funds?',
                    answer: 'Once the buyer confirms receipt or the auto-release period expires, funds are typically released immediately. The exact timing depends on the transaction type and any grace periods that may apply.'
                  },
                  {
                    question: 'Is Rift safe to use?',
                    answer: 'Yes! Rift uses bank-level encryption and secure payment processing through Stripe. Your funds are held securely until transactions are completed, and we never store your full payment card information.'
                  },
                  {
                    question: 'Why is my first withdrawal slower?',
                    answer: 'Your first withdrawal includes a one-time verification for safety and compliance. This helps us verify your account and protect both buyers and sellers. After this, future withdrawals are processed faster automatically.'
                  }
                ].map((item, idx) => {
                  const isOpen = openFaq === idx
                  return (
                    <div 
                      key={idx} 
                      className={`border-b border-gray-200 last:border-0 transition-all ${isOpen ? 'pb-6' : 'pb-0'}`}
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full text-left py-6 flex items-start justify-between gap-4 hover:opacity-80 transition-opacity group"
                      >
                        <h3 className="text-[#1d1d1f] font-light text-xl flex-1">
                          {item.question}
                        </h3>
                        <svg 
                          className={`w-5 h-5 ${colors.iconText} flex-shrink-0 mt-1 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <p className="text-gray-600 font-light leading-relaxed pr-12">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {type === 'contact' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-gray-700 leading-relaxed font-light mb-4 text-lg">
                    Need help? Contact our support team and we'll get back to you as soon as possible.
                  </p>
                  <a 
                    href="mailto:support@joinrift.co" 
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${colors.button} text-[#1d1d1f] transition-all font-light text-lg group/link`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>support@joinrift.co</span>
                    <svg className="w-5 h-5 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <svg className="w-5 h-5 text-[#86868b] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-600 font-light leading-relaxed">
                    We typically respond within 24 hours during business days.
                  </p>
                </div>
              </div>
            )}

            {type === 'report' && (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-gray-700 leading-relaxed font-light mb-4 text-lg">
                    If you've encountered a bug, issue, or have a feature request, please email us with details.
                  </p>
                  <a 
                    href="mailto:support@joinrift.co" 
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${colors.button} text-[#1d1d1f] transition-all font-light text-lg group/link`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>support@joinrift.co</span>
                    <svg className="w-5 h-5 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <svg className="w-5 h-5 text-[#86868b] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600 font-light leading-relaxed">
                      Please include as much detail as possible, including screenshots if applicable.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <svg className="w-5 h-5 text-[#86868b] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600 font-light leading-relaxed">
                      We review all reports and prioritize issues based on severity and impact.
                    </p>
                  </div>
                </div>
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
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading...</div>
      </div>
    }>
      <SupportContent />
    </Suspense>
  )
}
