'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MarketingLayout from '@/components/layouts/MarketingLayout'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import Tabs from '@/components/ui/Tabs'

export default function Pricing() {
  const { data: session, status } = useSession()
  const router = useRouter()

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

  const tiers = [
    {
      name: 'Personal',
      description: 'For casual deals',
      protectionFee: '3%',
      processingFee: '3%',
      features: [
        'Standard verification window',
        'Basic vault storage',
        'Email support',
        'Standard review time',
      ],
      cta: 'Get Started',
    },
    {
      name: 'Pro',
      description: 'For creators and power sellers',
      protectionFee: '3%',
      processingFee: '3%',
      features: [
        'Extended verification window',
        'Enhanced vault storage',
        'Priority review',
        'Priority support',
      ],
      cta: 'Get Started',
      popular: true,
    },
    {
      name: 'Business',
      description: 'For agencies and teams',
      protectionFee: '3%',
      processingFee: '3%',
      features: [
        'Extended verification window',
        'Unlimited vault storage',
        'Priority review',
        'Team accounts',
        'API access (coming soon)',
        'Dedicated support',
      ],
      cta: 'Contact Sales',
    },
  ]

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
    <MarketingLayout>
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

        {/* Pricing Tiers */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {tiers.map((tier, index) => (
              <GlassCard
                key={index}
                className={`p-8 relative ${tier.popular ? 'border-white/20 bg-white/5' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-light">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-light text-white mb-2">{tier.name}</h3>
                  <p className="text-white/60 font-light text-sm mb-6">{tier.description}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-3xl font-light text-white">Protection fee: </span>
                      <span className="text-3xl font-light text-white">{tier.protectionFee}</span>
                    </div>
                    <div>
                      <span className="text-sm text-white/60 font-light">Processing fee: </span>
                      <span className="text-sm text-white/60 font-light">{tier.processingFee}</span>
                    </div>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white/70 font-light text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.name === 'Business' ? '/contact' : '/auth/signup'} className="block">
                  <PremiumButton
                    size="lg"
                    className="w-full"
                    variant={tier.popular ? 'primary' : 'outline'}
                    glow={tier.popular}
                  >
                    {tier.cta}
                  </PremiumButton>
                </Link>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Fee Explanation */}
        <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <GlassCard className="p-8 lg:p-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-light text-white mb-4">Understanding fees</h2>
            </div>
            <div className="space-y-6 text-white/70 font-light text-sm">
              <div>
                <h3 className="text-white font-light mb-2">Protection fee (3%)</h3>
                <p className="text-white/60">
                  Covers platform services, dispute resolution, fraud prevention, and secure fund holding. 
                  This fee ensures your transaction is protected from start to finish.
                </p>
              </div>
              <div>
                <h3 className="text-white font-light mb-2">Processing fee (3%)</h3>
                <p className="text-white/60">
                  Covers payment processing costs, card network fees, and payment provider charges. 
                  This is standard for all card transactions.
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
    </MarketingLayout>
  )
}
