'use client'

import { useState, useEffect } from 'react'
import GlassCard from './ui/GlassCard'

interface RiskScoreBadgeProps {
  riftId: string
  compact?: boolean
}

interface RiskFactors {
  overallRisk: number
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  buyerRisk: number
  sellerRisk: number
  transactionRisk: number
  recommendations: string[]
  flags: string[]
}

export default function RiskScoreBadge({ riftId, compact = false }: RiskScoreBadgeProps) {
  const [riskData, setRiskData] = useState<RiskFactors | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRiskScore()
  }, [riftId])

  const loadRiskScore = async () => {
    try {
      const response = await fetch(`/api/rifts/${riftId}/risk-score`)
      if (response.ok) {
        const data = await response.json()
        setRiskData(data.riskFactors)
      }
    } catch (error) {
      console.error('Failed to load risk score:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !riskData) {
    return null
  }

  const getRiskColor = (tier: string) => {
    switch (tier) {
      case 'LOW':
        return 'text-green-400 border-green-400/30 bg-green-400/10'
      case 'MEDIUM':
        return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
      case 'HIGH':
        return 'text-orange-400 border-orange-400/30 bg-orange-400/10'
      case 'CRITICAL':
        return 'text-red-400 border-red-400/30 bg-red-400/10'
      default:
        return 'text-[#86868b] border-gray-200 bg-gray-50'
    }
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getRiskColor(riskData.riskTier)}`}>
        <div className="w-2 h-2 rounded-full bg-current opacity-60" />
        <span className="text-xs font-light">
          Risk: {riskData.riskTier} ({riskData.overallRisk})
        </span>
      </div>
    )
  }

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-600">Risk Assessment</h3>
        <div className={`px-3 py-1 rounded-lg border text-xs font-light ${getRiskColor(riskData.riskTier)}`}>
          {riskData.riskTier} ({riskData.overallRisk}/100)
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-[#86868b]">
          <span>Buyer Risk:</span>
          <span className={riskData.buyerRisk >= 60 ? 'text-orange-400' : 'text-[#86868b]'}>
            {riskData.buyerRisk}/100
          </span>
        </div>
        <div className="flex justify-between text-[#86868b]">
          <span>Seller Risk:</span>
          <span className={riskData.sellerRisk >= 60 ? 'text-orange-400' : 'text-[#86868b]'}>
            {riskData.sellerRisk}/100
          </span>
        </div>
        <div className="flex justify-between text-[#86868b]">
          <span>Transaction Risk:</span>
          <span className={riskData.transactionRisk >= 60 ? 'text-orange-400' : 'text-[#86868b]'}>
            {riskData.transactionRisk}/100
          </span>
        </div>
      </div>

      {riskData.flags.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-[#86868b] mb-1">Flags:</p>
          <div className="flex flex-wrap gap-1">
            {riskData.flags.map((flag, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-gray-50 text-xs text-[#86868b]">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {riskData.recommendations.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-[#86868b] mb-1">Recommendations:</p>
          <ul className="space-y-1">
            {riskData.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="text-xs text-[#86868b] flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  )
}

