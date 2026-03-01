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
          <div className="text-[#86868b] font-light">Loading wallet...</div>
        </div>
      </GlassCard>
    )
  }

  if (!wallet) {
    return null
  }

  return (
    <GlassCard className="mb-0 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-emerald-500/2 to-transparent hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 h-full flex flex-col">
      <div className="p-8 flex flex-col flex-1">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 flex items-center justify-center border border-emerald-500/25 shadow-lg shadow-emerald-500/10 flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-light text-[#1d1d1f] mb-1.5">Your Wallet</h2>
              </div>
            </div>
            <Link href="/wallet" className="text-xs text-emerald-600/80 hover:text-emerald-600 font-light flex items-center gap-1.5 transition-colors group">
              View Wallet
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Pending Balance */}
        {wallet.wallet.pendingBalance > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#86868b] font-light mb-1">Pending</p>
                <p className="text-lg font-light text-[#1d1d1f]">
                  {formatCurrency(wallet.wallet.pendingBalance, wallet.wallet.currency)}
                </p>
              </div>
              <svg className="w-5 h-5 text-emerald-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Balance Amount */}
        <div className="mb-4">
          <p className="text-3xl font-light text-[#1d1d1f] tracking-tight">
            {formatCurrency(wallet.wallet.availableBalance, wallet.wallet.currency)}
          </p>
        </div>

        {/* Action Button */}
        <div className="mb-6">
          {canWithdraw && wallet.wallet.availableBalance > 0 ? (
            <Link href="/wallet" className="block">
              <PremiumButton className="w-full text-sm py-3" glow>
                Withdraw Funds
              </PremiumButton>
            </Link>
          ) : (
            <Link href="/wallet" className="block">
              <div className="p-3 rounded-xl border border-gray-200 text-center hover:border-emerald-500/30 hover:bg-gray-50 transition-all duration-300">
                <p className="text-xs text-[#86868b] font-light">
                  {wallet.wallet.availableBalance <= 0 
                    ? 'No funds available'
                    : 'View Wallet'}
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* Recent Activity */}
        {wallet.ledgerEntries.length > 0 && (
          <div className="pt-6 border-t border-gray-200 flex-1 flex flex-col">
            <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-4">Recent Activity</p>
            <div className="space-y-2.5 flex-1">
              {wallet.ledgerEntries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200 transition-all duration-300 hover:bg-gray-100 hover:border-emerald-500/30 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate mb-1">{getLedgerTypeLabel(entry.type)}</p>
                    <p className="text-xs text-[#86868b] font-light">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-sm font-medium ${entry.amount >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                      {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount, entry.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {wallet.ledgerEntries.length > 3 && (
              <Link href="/wallet" className="block mt-4 text-center text-xs text-emerald-600/80 hover:text-emerald-600 font-light transition-colors">
                View All
              </Link>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  )
}
