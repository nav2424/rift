'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PremiumButton from '@/components/ui/PremiumButton'
import GlassCard from '@/components/ui/GlassCard'
import Link from 'next/link'

export default function Pricing() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [amount, setAmount] = useState('100')
  
  const calculateFee = (value: string) => {
    const num = parseFloat(value) || 0
    
    // Buyer fee: 3% of subtotal
    const buyerFee = num * 0.03
    const buyerPays = num + buyerFee
    
    // Seller fee: 5% of subtotal
    const sellerFee = num * 0.05
    const sellerReceives = num - sellerFee
    
    return { 
      subtotal: num,
      buyerFee,
      buyerPays,
      sellerFee,
      sellerReceives
    }
  }
  
  const { subtotal, buyerFee, buyerPays, sellerFee, sellerReceives } = calculateFee(amount)

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
    <div className="min-h-screen relative overflow-hidden bg-black pt-32 pb-32">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-light text-white mb-8 tracking-tight">
            Simple, Fair Pricing
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto font-light leading-relaxed">
            Buyers pay 3% processing fee. Sellers pay 5% platform fee. Transparent pricing for everyone.
          </p>
        </div>

        {/* Value Proposition Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <GlassCard variant="glass" className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-light text-white mb-4">Buyers Pay 3%</h3>
            <p className="text-white/70 font-light leading-relaxed">
              Small payment processing fee (3%) added to listed price. Covers card network and payment processing costs. Transparent and fair.
            </p>
          </GlassCard>

          <GlassCard variant="glass" className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-2xl font-light text-white mb-4">Complete Protection</h3>
            <p className="text-white/70 font-light leading-relaxed">
              Complete buyer protection, dispute resolution, fraud prevention, and transaction tracking. All included.
            </p>
          </GlassCard>

          <GlassCard variant="glass" className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-light text-white mb-4">Keep More Money</h3>
            <p className="text-white/70 font-light leading-relaxed">
              Sellers keep 95% of every transaction. No monthly fees, no setup costs, no hidden charges.
            </p>
          </GlassCard>
        </div>

        {/* Main Pricing Card */}
        <div className="max-w-4xl mx-auto mb-20">
          <GlassCard variant="liquid" className="p-12 md:p-16 border border-white/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-light text-white mb-6 tracking-tight">
                  One Simple Fee
                </h2>
                <p className="text-xl text-white/80 font-light mb-4">
                  For complete peace of mind on every transaction
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-12 items-center mb-12">
                {/* Buyer Side */}
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400 font-light text-sm">For Buyers</span>
                  </div>
                  <div className="mb-4">
                    <span className="text-5xl md:text-6xl font-light text-white">3%</span>
                    <span className="text-white/60 font-light text-xl ml-2">processing fee</span>
                  </div>
                  <p className="text-white/70 font-light text-lg mb-6">
                    Small processing fee covers card network and payment processing costs.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/80 font-light">
                      <svg className="w-5 h-5 text-green-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Transparent pricing</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80 font-light">
                      <svg className="w-5 h-5 text-green-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>No hidden charges</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80 font-light">
                      <svg className="w-5 h-5 text-green-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Complete buyer protection</span>
                    </div>
                  </div>
                </div>

                {/* Seller Side */}
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-blue-400 font-light text-sm">For Sellers</span>
                  </div>
                  <div className="mb-4">
                    <span className="text-5xl md:text-6xl font-light text-white">5%</span>
                    <span className="text-white/60 font-light text-xl ml-2">platform fee</span>
                  </div>
                  <p className="text-white/70 font-light text-lg mb-6">
                    Keep 95% of every sale. Small platform fee for complete protection and support.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/80 font-light">
                      <svg className="w-5 h-5 text-blue-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>No monthly subscriptions</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80 font-light">
                      <svg className="w-5 h-5 text-blue-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>No setup fees</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80 font-light">
                      <svg className="w-5 h-5 text-blue-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Full platform protection included</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-white/10">
                <p className="text-center text-white/60 font-light text-sm mb-8">
                  Buyer fee (3%) covers payment processing. Seller fee (5%) covers platform services and protection.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/auth/signup" className="block">
                    <PremiumButton size="lg" className="w-full sm:w-auto min-w-[240px] px-10 py-4" glow>
                      Start Protecting Transactions
                    </PremiumButton>
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* What You Get Section */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-light text-white mb-6 tracking-tight">
              Everything Included
            </h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto font-light">
              Your transaction fee covers comprehensive protection and support
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Buyer Protection',
                description: 'Funds held securely by Rift until both parties are satisfied',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )
              },
              {
                title: 'Dispute Resolution',
                description: 'Expert admin review and fair resolution process',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )
              },
              {
                title: 'Fraud Prevention',
                description: 'Identity verification and transaction monitoring',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )
              },
              {
                title: 'Transaction Tracking',
                description: 'Real-time updates and complete transaction history',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )
              },
              {
                title: 'Payment Processing',
                description: 'Secure card payments, Apple Pay, and Google Pay',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                )
              },
              {
                title: '24/7 Support',
                description: 'Email support and comprehensive help center',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )
              }
            ].map((item, index) => (
              <GlassCard key={index} variant="glass" className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-white/90 flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-light text-white mb-2">{item.title}</h3>
                    <p className="text-white/60 font-light text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Fee Calculator */}
        <div className="max-w-3xl mx-auto mb-20">
          <GlassCard variant="glass" className="p-10 md:p-12">
            <div className="text-center mb-10">
              <h3 className="text-3xl font-light text-white mb-4">See How It Works</h3>
              <p className="text-white/70 font-light">
                Calculate what you'll receive on any transaction
              </p>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="block text-white/80 font-light mb-3 text-lg">Transaction Amount</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-white/60 text-lg">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-6 pl-12 py-4 text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors text-lg font-light"
                    placeholder="100"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              <div className="space-y-6 pt-6 border-t border-white/10">
                {/* Buyer Section */}
                <div className="pb-6 border-b border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h4 className="text-xl font-light text-white">Buyer Pays</h4>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 font-light">Listed Price</span>
                      <span className="text-white font-light text-lg">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 font-light text-sm">Processing Fee (3%)</span>
                      <span className="text-white/70 font-light">+${buyerFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                      <span className="text-white font-light">Total You Pay</span>
                      <span className="text-green-400 font-light text-3xl">${buyerPays.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-white/50 font-light text-sm mt-3">3% processing fee covers card network and payment processing costs.</p>
                </div>

                {/* Seller Section */}
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-xl font-light text-white">Seller Receives</h4>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 font-light">Transaction Amount</span>
                      <span className="text-white font-light text-lg">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-white/60 font-light text-sm">Platform Fee (5%)</span>
                      <span className="text-white/70 font-light">-${sellerFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                      <span className="text-white font-light text-lg">You Receive</span>
                      <span className="text-green-400 font-light text-3xl">${sellerReceives.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-green-400/90 font-light text-sm text-center">
                      That's <strong className="font-normal">95%</strong> of the transaction amount
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Value Comparison */}
        <div className="max-w-5xl mx-auto mb-20">
          <GlassCard variant="glass" className="p-12">
            <div className="text-center mb-10">
              <h3 className="text-3xl font-light text-white mb-4">Why Rift Makes Sense</h3>
              <p className="text-white/70 font-light text-lg">
                A small fee for complete protection and peace of mind
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xl font-light text-white mb-6">Without Rift</h4>
                <div className="space-y-3">
                  {[
                    'Risk of losing your entire payment',
                    'No protection from scams or fraud',
                    'No dispute resolution process',
                    'Chargebacks and payment reversals',
                    'No transaction tracking or history'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-400/80 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-white/70 font-light">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xl font-light text-white mb-6">With Rift</h4>
                <div className="space-y-3">
                  {[
                    'Complete buyer protection included',
                    'Fraud prevention and identity verification',
                    'Expert dispute resolution service',
                    'No chargebacks or payment reversals',
                    'Full transaction tracking and history'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-400/80 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white/90 font-light">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Final CTA */}
        <div className="text-center max-w-4xl mx-auto">
          <GlassCard variant="light" className="p-12 md:p-16">
            <h3 className="text-3xl md:text-4xl font-light text-white mb-6">Start Protecting Your Transactions</h3>
            <p className="text-xl text-white/80 font-light mb-10 leading-relaxed">
              Join thousands who trust Rift for secure, protected transactions every day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <PremiumButton size="lg" className="w-full sm:w-auto px-12 py-4" glow>
                  Get Started Free
                </PremiumButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
