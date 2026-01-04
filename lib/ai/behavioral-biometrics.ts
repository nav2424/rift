/**
 * AI-Powered Behavioral Biometrics
 * 
 * Features:
 * - Detect account sharing or takeover
 * - Identify suspicious login patterns
 * - Analyze typing patterns (advanced, requires client-side data)
 */

import { prisma } from '../prisma'
import { createServerClient } from '../supabase'

export interface BehavioralAnalysis {
  accountSharingRisk: number // 0-100
  takeoverRisk: number // 0-100
  suspiciousPatterns: string[]
  recommendations: string[]
}

/**
 * Analyze behavioral patterns to detect account sharing or takeover
 */
export async function analyzeBehavioralPatterns(
  userId: string
): Promise<BehavioralAnalysis> {
  const suspiciousPatterns: string[] = []
  let accountSharingRisk = 0
  let takeoverRisk = 0

  // Get login/activity history from events
  const recentEvents = await prisma.rift_events.findMany({
    where: { actorId: userId },
    select: {
      ipHash: true,
      deviceFingerprint: true,
      createdAt: true,
      eventType: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  if (recentEvents.length === 0) {
    return {
      accountSharingRisk: 0,
      takeoverRisk: 0,
      suspiciousPatterns: [],
      recommendations: [],
    }
  }

  // Check for multiple devices/IPs in short timeframe (account sharing)
  const uniqueIPs = new Set(recentEvents.map(e => e.ipHash).filter(Boolean))
  const uniqueDevices = new Set(recentEvents.map(e => e.deviceFingerprint).filter(Boolean))

  if (uniqueIPs.size > 3 && recentEvents.length >= 10) {
    accountSharingRisk += 40
    suspiciousPatterns.push(`${uniqueIPs.size} different IP addresses used recently`)
  }

  if (uniqueDevices.size > 3 && recentEvents.length >= 10) {
    accountSharingRisk += 30
    suspiciousPatterns.push(`${uniqueDevices.size} different devices used recently`)
  }

  // Check for sudden location change (potential takeover)
  if (recentEvents.length >= 5) {
    const recentIPs = recentEvents.slice(0, 5).map(e => e.ipHash).filter(Boolean)
    const olderIPs = recentEvents.slice(5, 10).map(e => e.ipHash).filter(Boolean)
    
    const recentSet = new Set(recentIPs)
    const olderSet = new Set(olderIPs)
    const intersection = new Set([...recentSet].filter(x => olderSet.has(x)))
    
    // If no IP overlap between recent and older events, potential takeover
    if (intersection.size === 0 && recentIPs.length > 0 && olderIPs.length > 0) {
      takeoverRisk += 50
      suspiciousPatterns.push('Complete IP address change - no overlap with previous activity')
    }
  }

  // Check for unusual activity times (potential timezone change = account sharing)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  })

  if (user) {
    const eventHours = recentEvents
      .filter(e => e.createdAt)
      .map(e => new Date(e.createdAt).getHours())
    
    if (eventHours.length >= 10) {
      const hourSpread = Math.max(...eventHours) - Math.min(...eventHours)
      
      // If activity spans more than 12 hours, likely account sharing across timezones
      if (hourSpread > 12) {
        accountSharingRisk += 30
        suspiciousPatterns.push(`Activity spans ${hourSpread} hours (possible multiple timezones)`)
      }
    }
  }

  // Check for rapid-fire events from different IPs (bot or account sharing)
  if (recentEvents.length >= 10) {
    const rapidFireWindow = 5 * 60 * 1000 // 5 minutes
    let rapidFireCount = 0

    for (let i = 0; i < recentEvents.length - 1; i++) {
      const current = recentEvents[i]
      const next = recentEvents[i + 1]
      
      const timeDiff = new Date(current.createdAt).getTime() - new Date(next.createdAt).getTime()
      
      if (timeDiff < rapidFireWindow && current.ipHash !== next.ipHash) {
        rapidFireCount++
      }
    }

    if (rapidFireCount >= 3) {
      takeoverRisk += 40
      suspiciousPatterns.push('Rapid activity from different IP addresses')
    }
  }

  // Generate recommendations
  const recommendations: string[] = []
  
  if (accountSharingRisk >= 50) {
    recommendations.push('Consider requiring MFA verification')
    recommendations.push('Review account for unauthorized access')
  }
  
  if (takeoverRisk >= 50) {
    recommendations.push('Immediately require password reset')
    recommendations.push('Temporarily freeze account until verified')
  }

  return {
    accountSharingRisk: Math.min(100, accountSharingRisk),
    takeoverRisk: Math.min(100, takeoverRisk),
    suspiciousPatterns,
    recommendations,
  }
}

/**
 * Check if account should be flagged for security review
 */
export async function shouldFlagAccount(userId: string): Promise<{
  shouldFlag: boolean
  reason: string
  severity: 'low' | 'medium' | 'high'
}> {
  const analysis = await analyzeBehavioralPatterns(userId)

  if (analysis.takeoverRisk >= 70) {
    return {
      shouldFlag: true,
      reason: 'High account takeover risk detected',
      severity: 'high',
    }
  }

  if (analysis.accountSharingRisk >= 70) {
    return {
      shouldFlag: true,
      reason: 'High account sharing risk detected',
      severity: 'high',
    }
  }

  if (analysis.takeoverRisk >= 50 || analysis.accountSharingRisk >= 50) {
    return {
      shouldFlag: true,
      reason: 'Moderate security risk detected',
      severity: 'medium',
    }
  }

  return {
    shouldFlag: false,
    reason: '',
    severity: 'low',
  }
}

