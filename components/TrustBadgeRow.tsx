'use client'

import { useState, useEffect } from 'react'

interface Badge {
  id: string
  code: string
  label: string
  description: string
  icon: string | null
  awardedAt: string
}

interface TrustBadgeRowProps {
  userId: string
  className?: string
}

export default function TrustBadgeRow({ userId, className = '' }: TrustBadgeRowProps) {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await fetch(`/api/users/${userId}/badges`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setBadges(data.badges || [])
        }
      } catch (error) {
        console.error('Error fetching badges:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBadges()
  }, [userId])

  if (loading || badges.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="group relative px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg hover:bg-white/15 transition-colors"
          title={badge.description}
        >
          <span className="text-xs font-light text-white/80">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  )
}

