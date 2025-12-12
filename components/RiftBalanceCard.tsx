'use client'

import { useState, useEffect } from 'react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

interface BalanceData {
  availableBalance: number
  pendingBalance: number
  totalProcessedAmount: number
}

export default function RiftBalanceCard() {
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/me/balance', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setBalance(data)
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()

    // Poll for balance updates every 10 seconds
    const interval = setInterval(fetchBalance, 10000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <GlassCard variant="liquid" className="backdrop-blur-xl border border-white/10">
        <div className="p-6">
          <div className="text-white/40 font-light text-sm">Loading balance...</div>
        </div>
      </GlassCard>
    )
  }

  if (!balance) {
    return null
  }

  return (
    <GlassCard variant="liquid" className="backdrop-blur-xl border border-white/10">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-light text-white/50 tracking-wide uppercase">
            Balance
          </h2>
        </div>
        
        <div className="mb-6">
          <div className="text-4xl md:text-5xl font-light text-white mb-1 tracking-tight">
            ${balance.availableBalance.toFixed(2)}
          </div>
          <p className="text-xs text-white/40 font-light">Available to withdraw</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-white/5">
          <div>
            <p className="text-xs text-white/40 font-light mb-1">In transit</p>
            <p className="text-base text-white/80 font-light">
              ${balance.pendingBalance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40 font-light mb-1">Total processed</p>
            <p className="text-base text-white/80 font-light">
              ${balance.totalProcessedAmount.toFixed(2)}
            </p>
          </div>
        </div>

        <button 
          disabled
          className="liquid-glass w-full px-6 py-3 rounded-xl text-white/60 font-light text-sm tracking-wide border border-white/10 backdrop-blur-xl cursor-not-allowed opacity-50"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Withdraw (Coming soon)
          </span>
        </button>
      </div>
    </GlassCard>
  )
}

