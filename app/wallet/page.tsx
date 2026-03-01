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
  const [payouts, setPayouts] = useState<any[]>([])
  const [loadingPayouts, setLoadingPayouts] = useState(false)
  const [isFirstWithdrawal, setIsFirstWithdrawal] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadWallet()
      loadStripeStatus()
      loadPayoutHistory()
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
        // Check if response has content before parsing
        const contentType = response.headers.get('content-type')
        const text = await response.text()
        
        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from server')
        }
        
        let data
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          console.error('Failed to parse wallet response:', parseError)
          throw new Error('Invalid response format')
        }
        
        setWallet(data)
        
        // Check if user can withdraw
        const checkResponse = await fetch('/api/wallet/withdraw', {
          method: 'GET',
          credentials: 'include',
        })
        if (checkResponse.ok) {
          const checkText = await checkResponse.text()
          if (checkText && checkText.trim().length > 0) {
            try {
              const checkData = JSON.parse(checkText)
              setCanWithdraw(checkData.canWithdraw || false)
              if (!checkData.canWithdraw) {
                setWithdrawReason(checkData.reason || 'Cannot withdraw')
              } else {
                setWithdrawReason('') // Clear reason if withdrawal is allowed
              }
            } catch (parseError) {
              console.error('Failed to parse withdraw check response:', parseError)
              // Fallback: assume they can if balance > 0
              setCanWithdraw((data.wallet?.availableBalance || 0) > 0)
            }
          } else {
            // Empty response, use fallback
            setCanWithdraw((data.wallet?.availableBalance || 0) > 0)
          }
        } else {
          // Fallback: assume they can if balance > 0
          setCanWithdraw((data.wallet?.availableBalance || 0) > 0)
        }
      } else {
        // Handle error response
        const text = await response.text().catch(() => '')
        let errorData: any = {}
        if (text && text.trim().length > 0) {
          try {
            errorData = JSON.parse(text)
          } catch (parseError) {
            // Not JSON, use status text
          }
        }
        throw new Error(errorData.error || `Failed to load wallet: ${response.status}`)
      }
    } catch (error) {
      console.error('Error loading wallet:', error)
      showToast(error instanceof Error ? error.message : 'Failed to load wallet. Please try again.', 'error')
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
        const text = await response.text()
        if (text && text.trim().length > 0) {
          try {
            const data = JSON.parse(text)
            setStripeStatus(data)
          } catch (parseError) {
            console.error('Failed to parse Stripe status response:', parseError)
          }
        }
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
      
      console.log('[Stripe Connect] Response:', { 
        ok: response.ok, 
        hasOnboardingUrl: !!data.onboardingUrl,
        success: data.success,
        accountId: data.accountId 
      })
      
      if (response.ok && data.onboardingUrl) {
        // Redirect to Stripe onboarding
        console.log('[Stripe Connect] Redirecting to onboarding URL')
        window.location.href = data.onboardingUrl
      } else if (response.ok && data.refreshUrl) {
        // Account was created but link creation failed, try refresh URL
        console.log('[Stripe Connect] Account created, trying refresh URL')
        window.location.href = data.refreshUrl
      } else {
        const errorMessage = data.error || 'Failed to create Stripe account'
        console.error('[Stripe Connect] Error:', errorMessage)
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
      
      // Check if this is a first withdrawal
      const isFirst = data.isFirstWithdrawal !== false // Default to true if not specified
      
      if (isFirst) {
        showToast(
          'Withdrawal requested. This is your first withdrawal, so it may take up to 7 business days to process. You\'ll receive updates as it moves through review.',
          'success'
        )
      } else {
        showToast(`Withdrawal request submitted! Payout ID: ${data.payoutId}`, 'success')
      }
      
      setWithdrawAmount('')
      loadWallet()
      loadPayoutHistory() // Reload to update isFirstWithdrawal state
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
    return 'text-[#86868b]'
  }

  // Format Stripe requirement strings to be user-friendly
  const loadPayoutHistory = async () => {
    try {
      setLoadingPayouts(true)
      const response = await fetch('/api/wallet/payouts?limit=10', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setPayouts(data.data || [])
        // Check if this is a first withdrawal (no completed payouts)
        const completedPayouts = (data.data || []).filter((p: any) => p.status === 'COMPLETED')
        setIsFirstWithdrawal(completedPayouts.length === 0)
      }
    } catch (error) {
      console.error('Error loading payout history:', error)
    } finally {
      setLoadingPayouts(false)
    }
  }

  const getPayoutStatusLabel = (status: string, payout: any) => {
    // For first withdrawal, show more detailed status
    // Check if this payout is the first one (no completed payouts exist)
    const completedPayouts = payouts.filter((p: any) => p.status === 'COMPLETED')
    const isFirst = completedPayouts.length === 0 && payout
    
    if (isFirst) {
      const labels: Record<string, string> = {
        PENDING: 'Verification in progress',
        SCHEDULED: 'Scheduled for release',
        PROCESSING: 'Security review',
        COMPLETED: 'Funds sent',
        FAILED: 'Failed',
      }
      return labels[status] || status
    }
    
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      SCHEDULED: 'Scheduled',
      PROCESSING: 'Processing',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
    }
    return labels[status] || status
  }

  const getPayoutStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-400 border-green-500/30 bg-green-500/10'
      case 'FAILED':
        return 'text-red-400 border-red-500/30 bg-red-500/10'
      case 'PROCESSING':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      default:
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
    }
  }

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
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (!wallet) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">Unable to load wallet</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] mb-2 tracking-tight">Your Wallet</h1>
              <p className="text-[#86868b] font-light">Manage your balance and withdrawals</p>
            </div>
            <Link 
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Balance Card */}
        <GlassCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Available Balance</p>
                <p className="text-2xl md:text-3xl font-light text-[#1d1d1f] mb-2 tracking-tight">
                  {formatCurrency(wallet.wallet.availableBalance, wallet.wallet.currency)}
                </p>
                {wallet.wallet.pendingBalance > 0 && (
                  <p className="text-sm text-gray-400 font-light">
                    {formatCurrency(wallet.wallet.pendingBalance, wallet.wallet.currency)} pending
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center border border-green-500/20">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Stripe Connect Status */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-light text-[#1d1d1f]">Payment Account</h3>
                {stripeStatus && stripeStatus.connected && (
                  <button
                    onClick={loadStripeStatus}
                    className="text-gray-400 hover:text-[#86868b] transition-colors"
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
                  <div className="mb-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-[#86868b] font-light text-xs mb-2">
                      <strong className="text-gray-700">About Stripe's onboarding:</strong>
                    </p>
                    <ul className="text-[#86868b] font-light text-xs space-y-1 list-disc list-inside">
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
                <div className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600 font-light">Stripe Account</span>
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
                    <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <p className="text-[#86868b] font-light text-xs mb-3">
                        <strong className="text-gray-700">Action Required:</strong>
                      </p>
                      <div className="space-y-2">
                        {stripeStatus.requirements.currentlyDue.length > 0 && (
                          <div>
                            <p className="text-yellow-400 font-light text-xs mb-1">
                              <strong>Required:</strong>
                            </p>
                            <ul className="text-[#86868b] font-light text-xs space-y-1 ml-4 list-disc">
                              {stripeStatus.requirements.currentlyDue.slice(0, 5).map((req: string, idx: number) => (
                                <li key={idx}>{formatRequirement(req)}</li>
                              ))}
                              {stripeStatus.requirements.currentlyDue.length > 5 && (
                                <li className="text-gray-400 italic">+{stripeStatus.requirements.currentlyDue.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {stripeStatus.requirements.pastDue.length > 0 && (
                          <div>
                            <p className="text-red-400 font-light text-xs mb-1">
                              <strong>Past Due:</strong>
                            </p>
                            <ul className="text-[#86868b] font-light text-xs space-y-1 ml-4 list-disc">
                              {stripeStatus.requirements.pastDue.slice(0, 5).map((req: string, idx: number) => (
                                <li key={idx}>{formatRequirement(req)}</li>
                              ))}
                              {stripeStatus.requirements.pastDue.length > 5 && (
                                <li className="text-gray-400 italic">+{stripeStatus.requirements.pastDue.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {stripeStatus.requirements.pendingVerification.length > 0 && (
                          <div>
                            <p className="text-blue-400 font-light text-xs mb-1">
                              <strong>Verifying:</strong>
                            </p>
                            <ul className="text-[#86868b] font-light text-xs space-y-1 ml-4 list-disc">
                              {stripeStatus.requirements.pendingVerification.slice(0, 5).map((req: string, idx: number) => (
                                <li key={idx}>{formatRequirement(req)}</li>
                              ))}
                              {stripeStatus.requirements.pendingVerification.length > 5 && (
                                <li className="text-gray-400 italic">+{stripeStatus.requirements.pendingVerification.length - 5} more</li>
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
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-light text-[#1d1d1f] mb-4">Request Withdrawal</h3>
                
                {/* First-time withdrawal info */}
                {isFirstWithdrawal && canWithdraw && (
                  <div className="mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-blue-400/90 font-light text-sm mb-1">
                          <strong className="text-blue-300">First-time sellers:</strong> Your initial withdrawal takes up to 7 business days. Future withdrawals are faster.
                        </p>
                        <p className="text-blue-400/70 font-light text-xs">
                          This one-time delay helps us verify your account and protect both buyers and sellers. We'll notify you at every step.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {!canWithdraw && withdrawReason && (
                  <div className="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-yellow-400/90 font-light text-sm mb-3">
                      {withdrawReason}
                    </p>
                    {withdrawReason.toLowerCase().includes('phone') && (
                      <Link 
                        href="/settings/verification"
                        className="inline-block text-yellow-400 hover:text-yellow-300 font-light text-sm underline"
                      >
                        Verify Phone →
                      </Link>
                    )}
                    {withdrawReason.toLowerCase().includes('email') && !withdrawReason.toLowerCase().includes('phone') && (
                      <Link 
                        href="/settings/verification"
                        className="inline-block text-yellow-400 hover:text-yellow-300 font-light text-sm underline"
                      >
                        Verify Email →
                      </Link>
                    )}
                    {withdrawReason.toLowerCase().includes('stripe connect') && (
                      <button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        className="inline-block text-yellow-400 hover:text-yellow-300 font-light text-sm underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connectingStripe ? 'Loading...' : 'Set up Stripe Connect →'}
                      </button>
                    )}
                    {withdrawReason.toLowerCase().includes('stripe identity') && (
                      <button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        className="inline-block text-yellow-400 hover:text-yellow-300 font-light text-sm underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connectingStripe ? 'Loading...' : 'Complete Stripe Identity Verification →'}
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-light mb-2">
                      Amount <span className="text-[#86868b] font-light">({wallet.wallet.currency})</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#86868b] font-light">
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
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 pl-12 py-3 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 disabled:opacity-50 font-light"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-gray-400 font-light mt-2">
                      Maximum: <span className="text-[#86868b]">{formatCurrency(wallet.wallet.availableBalance, wallet.wallet.currency)}</span>
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

        {/* Withdrawal History */}
        {payouts.length > 0 && (
          <GlassCard className="mb-6">
            <div className="p-6">
              <h2 className="text-xl font-light text-[#1d1d1f] mb-6">Withdrawal History</h2>
              <div className="space-y-3">
                {payouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-gray-800 font-light">Withdrawal</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-light border ${getPayoutStatusColor(payout.status)}`}>
                          {getPayoutStatusLabel(payout.status, payout)}
                        </span>
                      </div>
                      <p className="text-xs text-[#86868b] font-light mt-1">
                        {new Date(payout.createdAt).toLocaleString()}
                      </p>
                      {(() => {
                        const completedPayouts = payouts.filter((p: any) => p.status === 'COMPLETED')
                        const isFirst = completedPayouts.length === 0 && payout.status !== 'COMPLETED'
                        return isFirst ? (
                          <p className="text-xs text-blue-400/80 font-light mt-1">
                            First withdrawal: Processing may take up to 7 business days. We'll keep you updated.
                          </p>
                        ) : null
                      })()}
                      {payout.failureReason && (
                        <p className="text-xs text-red-400 font-light mt-1">
                          {payout.failureReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-light text-red-400">
                        -{formatCurrency(payout.amount, payout.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Ledger */}
        <GlassCard>
          <div className="p-6">
            <h2 className="text-xl font-light text-[#1d1d1f] mb-6">Transaction History</h2>
            {wallet.ledgerEntries.length === 0 ? (
              <p className="text-[#86868b] font-light text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {wallet.ledgerEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex-1">
                      <p className="text-gray-800 font-light">{getLedgerTypeLabel(entry.type)}</p>
                      <p className="text-xs text-[#86868b] font-light mt-1">
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
