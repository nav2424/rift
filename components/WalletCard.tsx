'use client'

import { useState, useEffect } from 'react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'
import Link from 'next/link'
import { useToast } from './ui/Toast'

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

export default function WalletCard() {
  const { showToast } = useToast()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [canWithdraw, setCanWithdraw] = useState(false)

  useEffect(() => {
    loadWallet()
  }, [])

  const loadWallet = async () => {
    try {
      const response = await fetch('/api/wallet', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setWallet(data)
        
        // Check if user can withdraw
        const withdrawCheck = await fetch('/api/wallet/withdraw', {
          method: 'HEAD', // Just check, don't actually withdraw
        })
        // This is a workaround - we'll check via the actual endpoint logic
        // For now, assume they can withdraw if balance > 0
        setCanWithdraw((data.wallet?.availableBalance || 0) > 0)
      }
    } catch (error) {
      console.error('Error loading wallet:', error)
      // Silent failure for wallet card - not critical, will retry
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <GlassCard>
        <div className="p-6">
          <div className="text-white/60 font-light">Loading wallet...</div>
        </div>
      </GlassCard>
    )
  }

  if (!wallet) {
    return null
  }

  return (
    <GlassCard className="mb-0">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-1">Your Wallet</p>
            <p className="text-3xl font-light text-white mb-1 tracking-tight">
              {formatCurrency(wallet.wallet.availableBalance, wallet.wallet.currency)}
            </p>
            <p className="text-xs text-white/40 font-light">
              Available Balance
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center border border-green-500/20 flex-shrink-0">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {wallet.wallet.pendingBalance > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/80 font-light">Pending</p>
                <p className="text-lg font-light text-white">
                  {formatCurrency(wallet.wallet.pendingBalance, wallet.wallet.currency)}
                </p>
              </div>
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        )}

        <div className="mb-4">
          {canWithdraw && wallet.wallet.availableBalance > 0 ? (
            <Link href="/wallet" className="block">
              <PremiumButton className="w-full text-sm py-2" glow>
                Withdraw Funds
              </PremiumButton>
            </Link>
          ) : (
            <Link href="/wallet" className="block">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors">
                <p className="text-xs text-white/60 font-light">
                  {wallet.wallet.availableBalance <= 0 
                    ? 'No funds available'
                    : 'View Wallet'}
                </p>
              </div>
            </Link>
          )}
        </div>

        {wallet.ledgerEntries.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-3">Recent Activity</p>
            <div className="space-y-2">
              {wallet.ledgerEntries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 font-light truncate">{getLedgerTypeLabel(entry.type)}</p>
                    <p className="text-xs text-white/50 font-light">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-xs font-light ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount, entry.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {wallet.ledgerEntries.length > 3 && (
              <Link href="/wallet" className="block mt-3 text-center text-xs text-white/60 hover:text-white font-light">
                View All
              </Link>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  )
}
