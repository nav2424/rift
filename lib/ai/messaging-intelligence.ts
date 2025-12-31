/**
 * Messaging Intelligence System
 * Detects agreements, off-platform risks, conflicts
 */

import { prisma } from '../prisma'

export interface AgreementCapture {
  agreed: boolean
  terms: {
    price?: number
    deliveryTime?: string
    format?: string
    other?: Record<string, any>
  }
  confidence: number
  messageIds: string[]
}

export interface ConflictDetection {
  hasConflict: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  signals: string[]
  recommendation: string
}

export interface OffPlatformRisk {
  detected: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  attempts: string[]
  warnings: string[]
}

/**
 * Detect when terms are agreed in chat
 */
export async function captureAgreement(
  riftId: string
): Promise<AgreementCapture> {
  // Would fetch from chat system - simplified here
  // In production, integrate with your chat/conversation API

  const terms: AgreementCapture['terms'] = {}
  let agreed = false
  let confidence = 0
  const messageIds: string[] = []

  // Simplified detection - would use NLP/ML in production
  // Check if price, delivery time, format mentioned and confirmed

  return {
    agreed,
    terms,
    confidence,
    messageIds,
  }
}

/**
 * Detect attempts to move off-platform
 */
export async function detectOffPlatformRisk(
  riftId: string
): Promise<OffPlatformRisk> {
  // Would analyze chat messages for off-platform contact attempts
  const attempts: string[] = []
  const warnings: string[] = []

  // Patterns to detect
  const offPlatformPatterns = [
    /text me at/i,
    /call me at/i,
    /whatsapp/i,
    /telegram/i,
    /instagram/i,
    /snapchat/i,
    /move to/i,
    /contact me directly/i,
  ]

  // Would scan chat messages for these patterns
  // Simplified - return default for now

  const detected = attempts.length > 0
  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
    attempts.length >= 3 ? 'HIGH' :
    attempts.length >= 1 ? 'MEDIUM' : 'LOW'

  if (detected) {
    warnings.push('Keep all communication on Rift for your protection')
    warnings.push('Moving off-platform removes fraud protection')
  }

  return {
    detected,
    riskLevel,
    attempts,
    warnings,
  }
}

/**
 * Detect conflicts and rising hostility
 */
export async function detectConflict(
  riftId: string
): Promise<ConflictDetection> {
  // Would analyze chat sentiment and patterns
  const signals: string[] = []
  let hasConflict = false
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'

  // Simplified - would use sentiment analysis
  // Check for negative language, threats, etc.

  const recommendation = hasConflict
    ? 'Consider pausing transaction and clarifying requirements before proceeding'
    : 'Communication appears normal'

  return {
    hasConflict,
    severity,
    signals,
    recommendation,
  }
}

/**
 * Generate pre-flight checklist for rift creation
 */
export async function generatePreFlightChecklist(
  riftData: {
    itemType: string
    itemTitle?: string
    itemDescription?: string
    eventDate?: Date | null
    serviceDeliverables?: string
    completionCriteria?: string
  }
): Promise<{
  missing: string[]
  warnings: string[]
  recommendations: string[]
  score: number // 0-100
}> {
  const missing: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // Check title
  if (!riftData.itemTitle || riftData.itemTitle.trim().length < 5) {
    missing.push('Item title is missing or too short')
  }

  // Check description
  if (!riftData.itemDescription || riftData.itemDescription.trim().length < 20) {
    missing.push('Item description is missing or too brief')
    recommendations.push('Add detailed description to reduce disputes')
  }

  // Type-specific checks
  if (riftData.itemType === 'TICKETS') {
    if (!riftData.eventDate) {
      missing.push('Event date is required for tickets')
    }
    recommendations.push('Include event name, venue, and seat information')
  }

  if (riftData.itemType === 'SERVICES') {
    if (!riftData.serviceDeliverables) {
      missing.push('Service deliverables not specified')
    }
    if (!riftData.completionCriteria) {
      missing.push('Completion criteria not specified')
    }
    recommendations.push('Clearly define what will be delivered and how completion is measured')
  }

  // Calculate score
  const totalChecks = 4 + (riftData.itemType === 'TICKETS' ? 1 : 0) +
                      (riftData.itemType === 'SERVICES' ? 2 : 0)
  const passedChecks = totalChecks - missing.length
  const score = Math.round((passedChecks / totalChecks) * 100)

  return {
    missing,
    warnings,
    recommendations,
    score,
  }
}

