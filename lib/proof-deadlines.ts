/**
 * Proof Deadline Enforcement System
 * Enforces type-specific proof submission deadlines as per design requirements
 */

import { ItemType } from '@prisma/client'

export interface ProofDeadlineConfig {
  deadlineHours: number // Hours from FUNDED state to proof submission deadline
  minHours: number // Minimum deadline (for rush orders)
  maxHours: number // Maximum deadline (for complex items)
  autoReleaseAfterAccessHours?: number // Auto-release X hours after buyer first access (if enabled)
  autoReleaseAfterSubmissionHours: number // Auto-release X hours after proof submission (if buyer doesn't dispute)
}

/**
 * Proof deadline configs for UGC scope
 * SUPPORTED ITEM TYPES: DIGITAL_GOODS, SERVICES
 */
export const PROOF_DEADLINE_CONFIGS: Partial<Record<ItemType, ProofDeadlineConfig>> = {
  DIGITAL_GOODS: {
    deadlineHours: 24, // 24 hours for digital files
    minHours: 24,
    maxHours: 48,
    autoReleaseAfterAccessHours: 24, // Auto-release 24h after buyer downloads/opens
    autoReleaseAfterSubmissionHours: 48, // Fallback: 48h after submission
  },
  SERVICES: {
    deadlineHours: 24, // Based on agreed delivery date
    minHours: 24,
    maxHours: 168, // Up to 7 days for complex services
    autoReleaseAfterAccessHours: undefined, // Services don't have "access" concept
    autoReleaseAfterSubmissionHours: 72, // 72h after submission (3 days for buyer to review work)
  },
}

/**
 * Calculate proof submission deadline for a Rift
 */
export function calculateProofDeadline(
  itemType: ItemType,
  fundedAt: Date,
  agreedDeliveryDate?: Date | null
): Date {
  const config = PROOF_DEADLINE_CONFIGS[itemType]
  
  if (!config) {
    // Default for unsupported types: 24 hours
    return new Date(fundedAt.getTime() + 24 * 60 * 60 * 1000)
  }
  
  // For services, use agreed delivery date if provided
  if (itemType === 'SERVICES' && agreedDeliveryDate) {
    // Deadline is agreed date + grace window (24 hours buffer)
    return new Date(agreedDeliveryDate.getTime() + 24 * 60 * 60 * 1000)
  }
  
  // Otherwise use standard deadline hours
  return new Date(fundedAt.getTime() + config.deadlineHours * 60 * 60 * 1000)
}

/**
 * Check if proof deadline has passed
 */
export function isProofDeadlinePassed(
  itemType: ItemType,
  fundedAt: Date,
  proofSubmittedAt: Date | null,
  agreedDeliveryDate?: Date | null
): boolean {
  if (proofSubmittedAt) {
    return false // Proof already submitted
  }
  
  const deadline = calculateProofDeadline(itemType, fundedAt, agreedDeliveryDate)
  return new Date() > deadline
}

/**
 * Get hours until proof deadline (negative if passed)
 */
export function getHoursUntilProofDeadline(
  itemType: ItemType,
  fundedAt: Date,
  agreedDeliveryDate?: Date | null
): number {
  const deadline = calculateProofDeadline(itemType, fundedAt, agreedDeliveryDate)
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()
  return diffMs / (1000 * 60 * 60) // Convert to hours
}

/**
 * Calculate auto-release deadline based on buyer access
 * Uses access-based auto-release if configured, otherwise falls back to time-based
 */
export function calculateAutoReleaseDeadlineFromAccess(
  itemType: ItemType,
  proofSubmittedAt: Date,
  firstBuyerAccessAt: Date | null
): Date | null {
  const config = PROOF_DEADLINE_CONFIGS[itemType]
  
  if (!config) {
    // Default fallback
    return new Date(proofSubmittedAt.getTime() + 48 * 60 * 60 * 1000)
  }
  
  // If buyer has accessed content and access-based auto-release is configured
  if (firstBuyerAccessAt && config.autoReleaseAfterAccessHours) {
    return new Date(
      firstBuyerAccessAt.getTime() + config.autoReleaseAfterAccessHours * 60 * 60 * 1000
    )
  }
  
  // Fallback to submission-based auto-release
  return new Date(
    proofSubmittedAt.getTime() + config.autoReleaseAfterSubmissionHours * 60 * 60 * 1000
  )
}
