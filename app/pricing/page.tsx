'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import Tabs from '@/components/ui/Tabs'

export default function Pricing() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transactionAmount, setTransactionAmount] = useState('100')

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
    title: 'Buyer',
    description: 'Secure your payments',
    fee: '3%',
    feeLabel: 'Payment processing fee',
    benefits: [
      'Funds secured until delivery verified',
      'Automatic release after verification window',
      'Issue resolution support',
      'Full refund if terms not met',
    ],
  }

  const sellerCard = {
    title: 'Seller',
    description: 'Get paid with confidence',
    fee: '5%',
    feeLabel: 'Platform fee',
    benefits: [
      'Payment secured before delivery',
      'Fast payout after verification',
      'Dispute resolution support',
      'Vault storage for proof of delivery',
    ],
    popular: true,
  }

  const faqs = [
    {
      question: 'What happens if delivery is disputed?',
      answer: 'If an issue is raised, funds are frozen and our admin team reviews the case. Both parties can submit evidence. Resolution typically occurs within 24-48 hours.',
    },
    {
      question: 'How are funds released?',
      answer: 'Funds are automatically released after the verification window expires, unless an issue is raised. Buyers can also manually release funds earlier if satisfied.',
    },
    {
      question: 'Do you store my files?',
      answer: 'Files submitted to the Vault are stored securely and encrypted. Access is restricted to authorized parties and admins during review. Files are retained according to our data retention policy.',
    },
    {
      question: 'What types of deals are supported?',
      answer: 'Rift supports digital goods (usernames, licenses, files), tickets (digital transfer), services (milestone-based work), and physical items with proof of shipment.',
    },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-black pt-8 pb-32">
        {/* Hero */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-white mb-6 tracking-tight">
              Simple, transparent pricing
          </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto font-light">
              One fee structure. No hidden costs. No monthly subscriptions.
            </p>
            </div>
        </section>

        {/* Pricing Cards */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Buyer Card */}
            <GlassCard className="p-8">
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
                  Get Started as Buyer
                </PremiumButton>
              </Link>
            </GlassCard>

            {/* Seller Card */}
            <GlassCard className="p-8 relative border-white/20 bg-white/5">
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
                  variant="primary"
                  glow
                >
                  Get Started as Seller
                </PremiumButton>
              </Link>
            </GlassCard>
                  </div>
        </section>

        {/* Transaction Calculator */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-light text-white mb-4">Transaction Calculator</h2>
              <p className="text-white/60 font-light text-sm">
                See exactly how much each party pays in a transaction
              </p>
            </div>

            <div className="max-w-md mx-auto mb-8">
              <label htmlFor="amount" className="block text-sm font-light text-white/80 mb-2">
                Transaction Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60">$</span>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 font-light"
                  placeholder="100.00"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Buyer Breakdown */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-light text-white mb-4">Buyer Pays</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 font-light text-sm">Transaction amount</span>
                    <span className="text-white font-light">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 font-light text-sm">Processing fee (3%)</span>
                    <span className="text-white font-light">${buyerProcessingFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-light">Total</span>
                      <span className="text-xl font-light text-white">${buyerTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seller Breakdown */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-light text-white mb-4">Seller Receives</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 font-light text-sm">Transaction amount</span>
                    <span className="text-white font-light">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 font-light text-sm">Platform fee (5%)</span>
                    <span className="text-white font-light">-${sellerPlatformFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-light">Net payout</span>
                      <span className="text-xl font-light text-white">${sellerReceives.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-white/60 font-light text-sm">
                Fees are calculated automatically. No hidden costs.
              </p>
            </div>
          </GlassCard>
        </section>

        {/* Fee Explanation */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-light text-white mb-4">Understanding fees</h2>
                  </div>
            <div className="space-y-6 text-white/70 font-light text-sm">
              <div>
                <h3 className="text-white font-light mb-2">Payment processing fee (3% - paid by buyer)</h3>
                <p className="text-white/60">
                  Covers payment processing costs, card network fees, and payment provider charges. 
                  This is standard for all card transactions and is paid by the buyer when they secure funds.
                </p>
                    </div>
              <div>
                <h3 className="text-white font-light mb-2">Platform fee (5% - paid by seller)</h3>
                <p className="text-white/60">
                  Covers platform services, dispute resolution, fraud prevention, secure fund holding, and Vault storage. 
                  This fee is deducted from the seller's payout when funds are released.
                </p>
              </div>
              <div className="pt-6 border-t border-white/10">
                <p className="text-white/80 font-light">
                  <strong>No monthly fees.</strong> No setup costs. No hidden charges. 
                  You only pay when you use Rift.
                </p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* FAQ */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light text-white mb-4">Frequently asked questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <GlassCard key={index} className="p-6">
                <h3 className="text-lg font-light text-white mb-3">{faq.question}</h3>
                <p className="text-white/60 font-light text-sm leading-relaxed">{faq.answer}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
              <Link href="/auth/signup">
              <PremiumButton size="lg" className="min-w-[200px]" glow>
                Create a Rift
                </PremiumButton>
              </Link>
            </div>
        </section>
      </div>
  )
}
