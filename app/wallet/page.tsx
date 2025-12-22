'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

interface WalletData {
  wallet: {
    availableBalance: number
    pendingBalance: number
    currency: string
  }
  ledgerEntries: Array<{
    id: string
    type: string
    amount: number
    currency: string
    relatedRiftId: string | null
    metadata: any
    createdAt: string
  }>
}

export default function WalletPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [canWithdraw, setCanWithdraw] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [stripeStatus, setStripeStatus] = useState<any>(null)
  const [connectingStripe, setConnectingStripe] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadWallet()
      loadStripeStatus()
    }
  }, [status, router])

  // Check for Stripe return/refresh in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_return') === 'true' || params.get('stripe_refresh') === 'true') {
      // Reload Stripe status after returning from Stripe
      loadStripeStatus()
      // Also reload wallet to check withdrawal eligibility
      loadWallet()
      // Clean up URL
      window.history.replaceState({}, '', '/wallet')
    }
  }, [])

  // Auto-refresh Stripe status every 30 seconds if account is pending/under review
  useEffect(() => {
    if (!stripeStatus || stripeStatus.status === 'approved') return

    const interval = setInterval(() => {
      if (stripeStatus.status === 'pending' || stripeStatus.status === 'under_review') {
        loadStripeStatus()
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [stripeStatus?.status])

  const loadWallet = async () => {
    try {
      const response = await fetch('/api/wallet', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setWallet(data)
        
        // Check if user can withdraw
        const checkResponse = await fetch('/api/wallet/withdraw', {
          method: 'GET',
          credentials: 'include',
        })
        if (checkResponse.ok) {
          const checkData = await checkResponse.json()
          setCanWithdraw(checkData.canWithdraw || false)
          if (!checkData.canWithdraw) {
            setWithdrawReason(checkData.reason || 'Cannot withdraw')
          }
        } else {
          // Fallback: assume they can if balance > 0
          setCanWithdraw((data.wallet?.availableBalance || 0) > 0)
        }
      }
    } catch (error) {
      console.error('Error loading wallet:', error)
      showToast('Failed to load wallet. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadStripeStatus = async () => {
    try {
      const response = await fetch('/api/stripe/connect/status', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setStripeStatus(data)
      }
    } catch (error) {
      console.error('Error loading Stripe status:', error)
      // Silent failure for Stripe status - not critical
    }
  }

  const handleConnectStripe = async () => {
    setConnectingStripe(true)
    try {
      const response = await fetch('/api/stripe/connect/create', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok && data.onboardingUrl) {
        // Redirect to Stripe onboarding
        window.location.href = data.onboardingUrl
      } else {
        const errorMessage = data.error || 'Failed to create Stripe account'
        showToast(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error)
      showToast('Failed to connect Stripe account. Please try again.', 'error')
    } finally {
      setConnectingStripe(false)
    }
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    if (wallet && amount > wallet.wallet.availableBalance) {
      showToast('Insufficient balance', 'error')
      return
    }

    setWithdrawing(true)
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          currency: wallet?.wallet.currency || 'CAD',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        const errorMessage = error.error || 'Withdrawal failed'
        setWithdrawReason(error.reason || errorMessage)
        showToast(errorMessage, 'error')
        return
      }

      const data = await response.json()
      showToast(`Withdrawal request submitted! Payout ID: ${data.payoutId}`, 'success')
      setWithdrawAmount('')
      loadWallet()
    } catch (error) {
      console.error('Withdraw error:', error)
      showToast('Withdrawal failed. Please try again.', 'error')
    } finally {
      setWithdrawing(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getLedgerTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CREDIT_RELEASE: 'Funds Released',
      DEBIT_WITHDRAWAL: 'Withdrawal',
      DEBIT_CHARGEBACK: 'Chargeback',
      DEBIT_REFUND: 'Refund',
      ADJUSTMENT: 'Adjustment',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const getLedgerTypeColor = (type: string) => {
    if (type.includes('CREDIT')) return 'text-green-400'
    if (type.includes('DEBIT')) return 'text-red-400'
    return 'text-white/60'
  }

  // Format Stripe requirement strings to be user-friendly
  const formatRequirement = (requirement: string): string => {
    // Remove common prefixes
    let formatted = requirement
      .replace(/^(individual|business|company)\./, '')
      .replace(/^verification\./, '')
      .replace(/^external_account\./, '')
      .replace(/^relationship\./, '')
    
    // Replace underscores and dots with spaces
    formatted = formatted.replace(/[._]/g, ' ')
    
    // Capitalize first letter of each word
    formatted = formatted
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
    
    // Handle common abbreviations
    formatted = formatted
      .replace(/\bSin\b/gi, 'SIN')
      .replace(/\bSsn\b/gi, 'SSN')
      .replace(/\bEin\b/gi, 'EIN')
      .replace(/\bId\b/gi, 'ID')
      .replace(/\bDob\b/gi, 'Date of Birth')
      .replace(/\bProof Of Liveness\b/gi, 'Identity Verification')
      .replace(/\bIdentity Document\b/gi, 'ID Document')
    
    return formatted
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (!wallet) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Unable to load wallet</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/dashboard" className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tight">Your Wallet</h1>
          <p className="text-white/60 font-light">Manage your balance and withdrawals</p>
        </div>

        {/* Balance Card */}
        <GlassCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Available Balance</p>
                <p className="text-4xl md:text-5xl font-light text-white mb-2 tracking-tight">
                  {formatCurrency(wallet.wallet.availableBalance, wallet.wallet.currency)}
                </p>
                {wallet.wallet.pendingBalance > 0 && (
                  <p className="text-sm text-white/40 font-light">
                    {formatCurrency(wallet.wallet.pendingBalance, wallet.wallet.currency)} pending
                  </p>
                )}
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center border border-green-500/20">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Stripe Connect Status */}
            <div className="pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-light text-white">Payment Account</h3>
                {stripeStatus && stripeStatus.connected && (
                  <button
                    onClick={loadStripeStatus}
                    className="text-white/40 hover:text-white/60 transition-colors"
                    title="Refresh status"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
              {!stripeStatus || !stripeStatus.connected ? (
                <div className="mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-blue-400/90 font-light text-sm mb-3">
                    Connect your Stripe account to receive payouts. You'll be redirected to Stripe to complete the setup.
                  </p>
                  <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white/60 font-light text-xs mb-2">
                      <strong className="text-white/80">About Stripe's onboarding:</strong>
                    </p>
                    <ul className="text-white/50 font-light text-xs space-y-1 list-disc list-inside">
                      <li><strong>Account type:</strong> Set up as individual (not business)</li>
                      <li><strong>Tax information (SIN/SSN):</strong> Required by law for payment reporting</li>
                      <li><strong>Business fields:</strong> Stripe may ask for business name/description - you can use your personal name and "Personal transactions"</li>
                      <li><strong>All fields:</strong> Pre-filled where possible to minimize questions</li>
                      <li>All information is secure and only used for compliance purposes</li>
                    </ul>
                  </div>
                  <PremiumButton
                    onClick={handleConnectStripe}
                    disabled={connectingStripe}
                    className="w-full"
                    glow
                  >
                    {connectingStripe ? 'Connecting...' : 'Connect Stripe Account'}
                  </PremiumButton>
                </div>
              ) : (
                <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/70 font-light">Stripe Account</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-light ${
                      stripeStatus.status === 'approved'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : stripeStatus.status === 'rejected'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : stripeStatus.status === 'under_review'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {stripeStatus.status === 'approved'
                        ? '✓ Approved'
                        : stripeStatus.status === 'rejected'
                        ? '✗ Rejected'
                        : stripeStatus.status === 'under_review'
                        ? '⏳ Under Review'
                        : stripeStatus.status === 'restricted'
                        ? '⚠ Restricted'
                        : '⏳ Pending'}
                    </span>
                  </div>
                  
                  {/* Status Message */}
                  {stripeStatus.statusMessage && (
                    <p className={`text-xs font-light mb-3 ${
                      stripeStatus.status === 'approved'
                        ? 'text-green-400/90'
                        : stripeStatus.status === 'rejected'
                        ? 'text-red-400/90'
                        : stripeStatus.status === 'under_review'
                        ? 'text-blue-400/90'
                        : 'text-yellow-400/90'
                    }`}>
                      {stripeStatus.statusMessage}
                    </p>
                  )}

                  {/* Requirements */}
                  {stripeStatus.requirements && (
                    stripeStatus.requirements.currentlyDue.length > 0 ||
                    stripeStatus.requirements.pastDue.length > 0 ||
                    stripeStatus.requirements.pendingVerification.length > 0
                  ) && (
                    <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-white/60 font-light text-xs mb-3">
                        <strong className="text-white/80">Action Required:</strong>
                      </p>
                      <div className="space-y-2">
                        {stripeStatus.requirements.currentlyDue.length > 0 && (
                          <div>
                            <p className="text-yellow-400 font-light text-xs mb-1">
                              <strong>Required:</strong>
                            </p>
                            <ul className="text-white/60 font-light text-xs space-y-1 ml-4 list-disc">
                              {stripeStatus.requirements.currentlyDue.slice(0, 5).map((req: string, idx: number) => (
                                <li key={idx}>{formatRequirement(req)}</li>
                              ))}
                              {stripeStatus.requirements.currentlyDue.length > 5 && (
                                <li className="text-white/40 italic">+{stripeStatus.requirements.currentlyDue.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {stripeStatus.requirements.pastDue.length > 0 && (
                          <div>
                            <p className="text-red-400 font-light text-xs mb-1">
                              <strong>Past Due:</strong>
                            </p>
                            <ul className="text-white/60 font-light text-xs space-y-1 ml-4 list-disc">
                              {stripeStatus.requirements.pastDue.slice(0, 5).map((req: string, idx: number) => (
                                <li key={idx}>{formatRequirement(req)}</li>
                              ))}
                              {stripeStatus.requirements.pastDue.length > 5 && (
                                <li className="text-white/40 italic">+{stripeStatus.requirements.pastDue.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {stripeStatus.requirements.pendingVerification.length > 0 && (
                          <div>
                            <p className="text-blue-400 font-light text-xs mb-1">
                              <strong>Verifying:</strong>
                            </p>
                            <ul className="text-white/60 font-light text-xs space-y-1 ml-4 list-disc">
                              {stripeStatus.requirements.pendingVerification.slice(0, 5).map((req: string, idx: number) => (
                                <li key={idx}>{formatRequirement(req)}</li>
                              ))}
                              {stripeStatus.requirements.pendingVerification.length > 5 && (
                                <li className="text-white/40 italic">+{stripeStatus.requirements.pendingVerification.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {stripeStatus.status === 'rejected' && stripeStatus.disabledReason && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400/90 font-light text-xs">
                        <strong>Reason:</strong> {stripeStatus.disabledReason.replace(/rejected\./g, '').replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  {stripeStatus.status !== 'approved' && (
                    <div className="mt-3">
                      <PremiumButton
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        variant="outline"
                        className="w-full"
                      >
                        {connectingStripe ? 'Connecting...' : 
                         stripeStatus.status === 'rejected' ? 'Update Account' :
                         'Complete Setup'}
                      </PremiumButton>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Withdrawal Form */}
            {wallet.wallet.availableBalance > 0 && (
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-lg font-light text-white mb-4">Request Withdrawal</h3>
                {!canWithdraw && (
                  <div className="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-yellow-400/90 font-light text-sm mb-3">
                      Complete verification to withdraw: Phone verified, Stripe Connect account set up, and Stripe Identity verification completed.
                    </p>
                    <Link 
                      href="/settings/verification"
                      className="inline-block text-yellow-400 hover:text-yellow-300 font-light text-sm underline"
                    >
                      Verify Phone →
                    </Link>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/80 font-light mb-2">
                      Amount <span className="text-white/50 font-light">({wallet.wallet.currency})</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 font-light">
                        {wallet.wallet.currency}
                      </span>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        max={wallet.wallet.availableBalance}
                        min="0"
                        step="0.01"
                        disabled={!canWithdraw || withdrawing}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pl-12 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30 disabled:opacity-50 font-light"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-white/40 font-light mt-2">
                      Maximum: <span className="text-white/60">{formatCurrency(wallet.wallet.availableBalance, wallet.wallet.currency)}</span>
                    </p>
                  </div>
                  <PremiumButton
                    onClick={handleWithdraw}
                    disabled={!canWithdraw || withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="w-full"
                    glow
                  >
                    {withdrawing ? 'Processing...' : 'Request Withdrawal'}
                  </PremiumButton>
                  {withdrawReason && (
                    <p className="text-sm text-red-400 font-light">{withdrawReason}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Ledger */}
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-light text-white mb-6">Transaction History</h2>
            {wallet.ledgerEntries.length === 0 ? (
              <p className="text-white/60 font-light text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {wallet.ledgerEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex-1">
                      <p className="text-white/90 font-light">{getLedgerTypeLabel(entry.type)}</p>
                      <p className="text-xs text-white/50 font-light mt-1">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.relatedRiftId && (
                        <Link 
                          href={`/rifts/${entry.relatedRiftId}`}
                          className="text-xs text-blue-400/80 hover:text-blue-400 font-light mt-1 block"
                        >
                          View Rift →
                        </Link>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-light ${getLedgerTypeColor(entry.type)}`}>
                        {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount, entry.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
