'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

export default function Pricing() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transactionAmount, setTransactionAmount] = useState('1000')
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

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

  // Calculate fees
  const amount = parseFloat(transactionAmount) || 0
  const buyerProcessingFee = amount * 0.03
  const buyerTotal = amount + buyerProcessingFee
  const sellerPlatformFee = amount * 0.05
  const sellerReceives = amount - sellerPlatformFee

  const buyerCard = {
    title: 'Brands & Agencies',
    description: 'Secure your influencer partnerships',
    fee: '3%',
    feeLabel: 'Payment processing fee',
    benefits: [
      'Funds secured until content approved',
      'Automatic release after verification window',
      'Issue resolution support',
      'Full refund if deliverables not met',
    ],
  }

  const sellerCard = {
    title: 'Creators & Influencers',
    description: 'Get paid with confidence',
    fee: '5%',
    feeLabel: 'Platform fee',
    benefits: [
      'Payment secured before you start work',
      'Fast payout after content approval',
      'Dispute resolution support',
      'Secure Vault storage for deliverables',
    ],
    popular: true,
  }

  const faqs = [
    {
      question: 'What happens if content doesn\'t meet requirements?',
      answer: 'If an issue is raised, funds are frozen and our admin team reviews the case. Both parties can submit evidence including deliverables, briefs, and communication. Resolution typically occurs within 24-48 hours.',
    },
    {
      question: 'How are funds released?',
      answer: 'Funds are automatically released after the verification window expires (typically 24-72 hours), unless an issue is raised. Brands/agencies can also manually release funds earlier if satisfied with deliverables.',
    },
    {
      question: 'Do you store my files and content?',
      answer: 'Files submitted to the Vault are stored securely and encrypted. Access is restricted to authorized parties (buyer and seller) and admins during review. Files are retained according to our data retention policy.',
    },
    {
      question: 'What types of brand deals are supported?',
      answer: 'Rift supports brand deals, UGC content, influencer partnerships, and agency deliverables. Both milestone-based service payments and content deliverables are supported.',
    },
    {
      question: 'Can I use Rift for recurring brand partnerships?',
      answer: 'Yes! Each Rift transaction is independent, so you can create multiple Rifts for the same brand partnership. This makes it perfect for ongoing collaborations with milestone-based payments.',
    },
    {
      question: 'Are there any monthly fees or subscriptions?',
      answer: 'No. Rift charges only on successful transactions. No monthly fees, no setup costs, no hidden charges. You only pay when you use Rift.',
    },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-black pt-8 pb-32">
        {/* Hero */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass-soft px-3 sm:px-4 py-1.5 sm:py-2 text-xs text-white/60 mb-6 sm:mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              SIMPLE PRICING • NO SUBSCRIPTIONS
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-light mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                Simple, transparent pricing
              </span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto font-light">
              One fee structure. No hidden costs. No monthly subscriptions. Pay only when you use Rift.
            </p>
            </div>
        </section>

        {/* Pricing Cards */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Buyer Card */}
            <GlassCard className="p-8 glass-highlight">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-light text-white mb-2">{buyerCard.title}</h3>
                <p className="text-white/60 font-light text-sm mb-6">{buyerCard.description}</p>
                <div>
                  <div className="text-3xl font-light text-white mb-1">{buyerCard.fee}</div>
                  <div className="text-sm text-white/60 font-light">{buyerCard.feeLabel}</div>
        </div>
              </div>
              <ul className="space-y-3 mb-8">
                {buyerCard.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/70 font-light text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block">
                <PremiumButton
                  size="lg"
                  className="w-full"
                  variant="outline"
                >
                  Get Started as Brand
                </PremiumButton>
              </Link>
            </GlassCard>

            {/* Seller Card */}
            <GlassCard className="p-8 glass-highlight relative border-white/20">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-light text-white mb-2">{sellerCard.title}</h3>
                <p className="text-white/60 font-light text-sm mb-6">{sellerCard.description}</p>
                <div>
                  <div className="text-3xl font-light text-white mb-1">{sellerCard.fee}</div>
                  <div className="text-sm text-white/60 font-light">{sellerCard.feeLabel}</div>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {sellerCard.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/70 font-light text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block">
                <PremiumButton
                  size="lg"
                  className="w-full"
                  variant="outline"
                >
                  Get Started as Creator
                </PremiumButton>
              </Link>
            </GlassCard>
                  </div>
        </section>

        {/* Transaction Calculator */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12 glass-highlight">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
                <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                  Calculator
                </span>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium text-white mb-4 tracking-tight">
                Fee <span className="text-emerald-400/40">Calculator</span>
              </h2>
              <p className="text-white/60 font-light text-base max-w-xl mx-auto">
                See exactly how fees work for your brand deals
              </p>
            </div>

            <div className="max-w-md mx-auto mb-10">
              <label htmlFor="amount" className="block text-sm font-medium text-white/80 mb-3">
                Deal Amount (USD)
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 text-lg font-light">$</span>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all font-light hover:bg-white/[0.07] hover:border-white/15"
                  placeholder="1000.00"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/0 via-emerald-400/5 to-emerald-400/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {/* Buyer Breakdown */}
              <div className="rounded-2xl glass-soft p-6 lg:p-8 border border-white/10 hover:border-white/15 hover:bg-white/[0.025] transition-all duration-300 group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-400/15 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-white">Brand Pays</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60 font-light text-sm">Deal amount</span>
                    <span className="text-white font-medium font-mono">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60 font-light text-sm">Processing fee (3%)</span>
                    <span className="text-white/80 font-light text-sm font-mono">+${buyerProcessingFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">Total</span>
                      <span className="text-2xl font-medium text-emerald-400 font-mono">${buyerTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seller Breakdown */}
              <div className="rounded-2xl glass-soft p-6 lg:p-8 border border-white/10 hover:border-white/15 hover:bg-white/[0.025] transition-all duration-300 group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-400/15 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-white">Creator Receives</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60 font-light text-sm">Deal amount</span>
                    <span className="text-white font-medium font-mono">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60 font-light text-sm">Platform fee (5%)</span>
                    <span className="text-white/80 font-light text-sm font-mono text-red-400/60">-${sellerPlatformFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">Net payout</span>
                      <span className="text-2xl font-medium text-emerald-400 font-mono">${sellerReceives.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 text-center">
              <p className="text-white/60 font-light text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-emerald-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Fees are calculated automatically. No hidden costs.
              </p>
            </div>
          </GlassCard>
        </section>

        {/* Fee Explanation */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12 glass-highlight">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
                <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                  Details
                </span>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">
                Understanding <span className="text-emerald-400/40">fees</span>
              </h2>
            </div>
            <div className="space-y-8">
              <div className="rounded-xl glass-soft p-6 border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-medium text-lg mb-2">Payment processing fee (3% - paid by brand)</h3>
                    <p className="text-white/60 font-light text-sm leading-relaxed">
                      Covers payment processing costs, card network fees, and payment provider charges. 
                      This is standard for all card transactions and is paid by the brand when they secure funds for the deal.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl glass-soft p-6 border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-medium text-lg mb-2">Platform fee (5% - paid by creator)</h3>
                    <p className="text-white/60 font-light text-sm leading-relaxed">
                      Covers platform services including secure fund holding, dispute resolution, fraud prevention, Vault storage for deliverables, 
                      and payment processing. This fee is deducted from the creator's payout when funds are released.
                    </p>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-white/10 rounded-xl glass-soft p-6">
                <p className="text-white/80 font-light text-base text-center">
                  <strong className="text-white font-medium">No monthly fees.</strong> No setup costs. No hidden charges. 
                  You only pay when you use Rift for a brand deal.
                </p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* FAQ */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                FAQ
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-400/30" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white mb-6 tracking-tight">
              Frequently asked <span className="text-emerald-400/40">questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index
              return (
                <GlassCard key={index} className="glass-highlight overflow-hidden transition-all">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-6 lg:p-8 text-left hover:bg-white/[0.02] transition-all flex items-start justify-between gap-4"
                  >
                    <h3 className="text-lg font-medium text-white flex-1 transition-colors group-hover:text-emerald-400/30">
                      {faq.question}
                    </h3>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg glass-soft flex items-center justify-center text-white/60 transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-6 lg:px-8 pb-6 lg:pb-8 pt-0">
                      <p className="text-white/60 font-light text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-emerald-400/30" />
              <span className="text-xs font-mono text-emerald-400/60 uppercase tracking-wider">
                Ready to start
              </span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-emerald-400/30" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white mb-8 tracking-tight leading-tight">
              Stop chasing payments.<br />
              Secure your brand deals.
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
