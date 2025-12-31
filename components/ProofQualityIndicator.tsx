'use client'

import { useState, useEffect } from 'react'
import GlassCard from './ui/GlassCard'

interface ProofQualityIndicatorProps {
  riftId: string
  assetIds: string[]
  onQualityChange?: (quality: number) => void
}

interface QualityScore {
  overall: number
  completeness: number
  relevance: number
  quality: number
  warnings: string[]
  recommendations: string[]
  passed: boolean
}

export default function ProofQualityIndicator({
  riftId,
  assetIds,
  onQualityChange,
}: ProofQualityIndicatorProps) {
  const [qualityData, setQualityData] = useState<QualityScore | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (assetIds.length > 0) {
      checkQuality()
    } else {
      setQualityData(null)
    }
  }, [riftId, assetIds.join(',')])

  const checkQuality = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/rifts/${riftId}/proof/quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds }),
      })

      if (response.ok) {
        const data = await response.json()
        setQualityData(data)
        onQualityChange?.(data.overall)
      }
    } catch (error) {
      console.error('Failed to check proof quality:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!qualityData && !loading) {
    return null
  }

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getQualityLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">Proof Quality</h3>
        {qualityData && (
          <div className={`text-sm font-light ${getQualityColor(qualityData.overall)}`}>
            {qualityData.overall}/100 - {getQualityLabel(qualityData.overall)}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-white/40 text-xs">Analyzing proof quality...</div>
      ) : qualityData ? (
        <>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-white/60">
              <span>Completeness:</span>
              <span className={getQualityColor(qualityData.completeness)}>
                {qualityData.completeness}/100
              </span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Relevance:</span>
              <span className={getQualityColor(qualityData.relevance)}>
                {qualityData.relevance}/100
              </span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Quality:</span>
              <span className={getQualityColor(qualityData.quality)}>
                {qualityData.quality}/100
              </span>
            </div>
          </div>

          {qualityData.warnings.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-orange-400 mb-1">Warnings:</p>
              <ul className="space-y-1">
                {qualityData.warnings.map((warning, i) => (
                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">⚠</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {qualityData.recommendations.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/50 mb-1">Recommendations:</p>
              <ul className="space-y-1">
                {qualityData.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                    <span className="text-white/40 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {qualityData.passed && (
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Proof quality meets requirements
              </div>
            </div>
          )}
        </>
      ) : null}
    </GlassCard>
  )
}

