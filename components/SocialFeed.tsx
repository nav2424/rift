'use client'

import { useState, useEffect } from 'react'
import GlassCard from './ui/GlassCard'
import { useToast } from './ui/Toast'

interface Activity {
  id: string
  type: string
  summary: string
  amount: number | null
  createdAt: string
}

export default function SocialFeed() {
  const { showToast } = useToast()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activity/feed?limit=20', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
      // Silent failure for activity feed - not critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()

    // Poll for new activities every 30 seconds
    const interval = setInterval(fetchActivities, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <GlassCard>
        <div className="p-6">
          <div className="text-[#86868b] font-light">Loading activity...</div>
        </div>
      </GlassCard>
    )
  }

  if (activities.length === 0) {
    return (
      <GlassCard>
        <div className="p-6">
          <h2 className="text-xl font-light text-[#1d1d1f] mb-4">Activity Feed</h2>
          <p className="text-gray-400 font-light text-sm">
            Activity feed will appear here as users complete transactions
          </p>
        </div>
      </GlassCard>
    )
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  return (
    <GlassCard>
      <div className="p-6">
        <h2 className="text-xl font-light text-[#1d1d1f] mb-6">Activity Feed</h2>
        
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <p className="text-[#1d1d1f] font-light text-sm leading-relaxed">
                {activity.summary}
              </p>
              <p className="text-xs text-gray-400 font-light mt-2">
                {formatTime(activity.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

