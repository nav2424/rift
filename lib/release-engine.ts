/**
 * Release Engine - Deterministic rules for when funds can be released
 * 
 * This module implements category-specific release eligibility rules
 * and handles the actual fund release process.
 */

import { prisma } from './prisma'
import { createServerClient } from './supabase'
import { logEvent, extractRequestMetadata } from './rift-events'
import { RiftEventActorType } from '@prisma/client'
import { predictReleaseTiming } from './ai/release-timing'

export interface ReleaseEligibilityResult {
  eligible: boolean
  reason?: string
  category?: string
  details?: Record<string, any>
}

/**
 * Compute release eligibility for a Rift
 * 
 * Rules by category:
 * - DIGITAL: Eligible if buyer confirmed receipt OR 48h after upload with no dispute + low risk
 * - SERVICES: Eligible if buyer confirmed receipt OR auto-release after X days (risk-based)
 * - TICKETS: Eligible if buyer confirmed receipt OR event_date passed + seller_sent + no dispute
 */
export async function computeReleaseEligibility(
  riftId: string
): Promise<ReleaseEligibilityResult> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      status: true,
      itemType: true,
      riskScore: true,
      fundedAt: true,
      releaseEligibleAt: true,
      eventDate: true,
      eventDateTz: true,
      sellerId: true,
    },
  })

  if (!rift) {
    return { eligible: false, reason: 'Rift not found' }
  }

  // Basic eligibility checks
  if (['DISPUTED', 'REFUNDED', 'CANCELED', 'CANCELLED'].includes(rift.status)) {
    return { eligible: false, reason: `Rift status is ${rift.status}` }
  }

  // Check for active disputes in Supabase (Phase 4)
  const supabase = createServerClient()
  const { data: activeDisputes } = await supabase
    .from('disputes')
    .select('id, status')
    .eq('rift_id', riftId)
    .in('status', ['submitted', 'needs_info', 'under_review'])

  if (activeDisputes && activeDisputes.length > 0) {
    return { eligible: false, reason: 'Active dispute exists' }
  }

  // Check for frozen funds (Phase 6)
  const { data: sellerRestrictions } = await supabase
    .from('user_restrictions')
    .select('funds_frozen')
    .eq('user_id', rift.sellerId)
    .maybeSingle()

  if (sellerRestrictions?.funds_frozen) {
    return { eligible: false, reason: 'Seller funds are frozen' }
  }

  // Check for Stripe disputes (Phase 6)
  const { data: stripeDisputes } = await supabase
    .from('stripe_disputes')
    .select('id, status')
    .eq('rift_id', riftId)
    .in('status', ['needs_response', 'warning_needs_response', 'under_review'])

  if (stripeDisputes && stripeDisputes.length > 0) {
    return { eligible: false, reason: 'Active Stripe dispute exists' }
  }

  // If already marked eligible, return early
  if (rift.releaseEligibleAt) {
    return {
      eligible: true,
      reason: 'Already marked eligible',
      category: rift.itemType,
      details: { releaseEligibleAt: rift.releaseEligibleAt },
    }
  }

  // Category-specific rules
  switch (rift.itemType) {
    case 'DIGITAL':
      return await checkDigitalGoodsEligibility(riftId, rift)
    
    case 'SERVICES':
      return await checkServicesEligibility(riftId, rift)
    
    case 'TICKETS':
      return await checkTicketsEligibility(riftId, rift)
    
    default:
      return { eligible: false, reason: `Category ${rift.itemType} not supported for auto-release` }
  }
}

/**
 * Check eligibility for digital goods
 */
async function checkDigitalGoodsEligibility(
  riftId: string,
  rift: { id: string; riskScore: number; fundedAt: Date | null }
): Promise<ReleaseEligibilityResult> {
  const supabase = createServerClient()

  // Check if buyer confirmed receipt (via event log)
  const confirmedEvent = await prisma.rift_events.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_RECEIPT',
    },
  })

  if (confirmedEvent) {
    return {
      eligible: true,
      reason: 'Buyer confirmed receipt',
      category: 'DIGITAL',
      details: { confirmedAt: confirmedEvent.createdAt },
    }
  }

  // Check delivery upload time
  const { data: delivery } = await supabase
    .from('digital_deliveries')
    .select('uploaded_at')
    .eq('rift_id', riftId)
    .single()

  if (!delivery) {
    return { eligible: false, reason: 'No delivery uploaded yet' }
  }

  const uploadTime = new Date(delivery.uploaded_at)
  const now = new Date()
  const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60)

  // Check if buyer has viewed/downloaded
  const { data: views } = await supabase
    .from('delivery_views')
    .select('downloaded, seconds_viewed')
    .eq('rift_id', riftId)

  const hasDownloaded = views?.some(v => v.downloaded === true)
  const hasViewed30s = views?.some(v => (v.seconds_viewed || 0) >= 30)

  // Eligible if:
  // - 48 hours passed since upload AND
  // - (buyer downloaded OR viewed 30+ seconds) AND
  // - low risk (riskScore <= 30)
  if (hoursSinceUpload >= 48 && (hasDownloaded || hasViewed30s) && rift.riskScore <= 30) {
    return {
      eligible: true,
      reason: '48h after upload with engagement and low risk',
      category: 'DIGITAL',
      details: {
        hoursSinceUpload: Math.round(hoursSinceUpload),
        hasDownloaded,
        hasViewed30s,
        riskScore: rift.riskScore,
      },
    }
  }

  return {
    eligible: false,
    reason: 'Conditions not met for auto-release',
    category: 'DIGITAL',
    details: {
      hoursSinceUpload: Math.round(hoursSinceUpload),
      hasDownloaded,
      hasViewed30s,
      riskScore: rift.riskScore,
    },
  }
}

/**
 * Check eligibility for services
 */
async function checkServicesEligibility(
  riftId: string,
  rift: { id: string; riskScore: number; fundedAt: Date | null }
): Promise<ReleaseEligibilityResult> {
  // Check if buyer confirmed completion
  const confirmedEvent = await prisma.rift_events.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_RECEIPT',
    },
  })

  if (confirmedEvent) {
    return {
      eligible: true,
      reason: 'Buyer confirmed completion',
      category: 'SERVICES',
      details: { confirmedAt: confirmedEvent.createdAt },
    }
  }

  // Check when seller marked delivered
  const markedDeliveredEvent = await prisma.rift_events.findFirst({
    where: {
      riftId,
      eventType: 'SELLER_MARKED_DELIVERED',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!markedDeliveredEvent) {
    return { eligible: false, reason: 'Seller has not marked service as delivered' }
  }

  const markedAt = markedDeliveredEvent.createdAt
  const now = new Date()
  const daysSinceMarked = (now.getTime() - markedAt.getTime()) / (1000 * 60 * 60 * 24)

  // Risk-based auto-release: 3 days for low-risk, 7 days for high-risk
  const autoReleaseDays = rift.riskScore <= 30 ? 3 : 7

  if (daysSinceMarked >= autoReleaseDays) {
    return {
      eligible: true,
      reason: `Auto-release after ${autoReleaseDays} days (risk-based)`,
      category: 'SERVICES',
      details: {
        daysSinceMarked: Math.round(daysSinceMarked * 10) / 10,
        riskScore: rift.riskScore,
        autoReleaseDays,
      },
    }
  }

  return {
    eligible: false,
    reason: `Waiting for ${autoReleaseDays} days since marked delivered`,
    category: 'SERVICES',
    details: {
      daysSinceMarked: Math.round(daysSinceMarked * 10) / 10,
      riskScore: rift.riskScore,
      autoReleaseDays,
    },
  }
}

/**
 * Check eligibility for tickets
 */
async function checkTicketsEligibility(
  riftId: string,
  rift: {
    id: string
    riskScore: number
    eventDate: string | null
    eventDateTz: Date | null
  }
): Promise<ReleaseEligibilityResult> {
  // Check if buyer confirmed receipt
  const confirmedEvent = await prisma.rift_events.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_TICKET_RECEIPT',
    },
  })

  if (confirmedEvent) {
    return {
      eligible: true,
      reason: 'Buyer confirmed ticket receipt',
      category: 'TICKETS',
      details: { confirmedAt: confirmedEvent.createdAt },
    }
  }

  // Check if seller claimed transfer sent
  const supabase = createServerClient()
  const { data: transfer } = await supabase
    .from('ticket_transfers')
    .select('seller_claimed_sent_at, status')
    .eq('rift_id', riftId)
    .single()

  if (!transfer || transfer.status !== 'seller_sent') {
    return { eligible: false, reason: 'Seller has not claimed transfer sent' }
  }

  // Check event date
  if (rift.eventDateTz) {
    const eventDate = new Date(rift.eventDateTz)
    const now = new Date()

    // If event has passed, eligible (if low risk)
    if (now >= eventDate && rift.riskScore <= 50) {
      return {
        eligible: true,
        reason: 'Event date passed with seller_sent and low risk',
        category: 'TICKETS',
        details: {
          eventDate: eventDate.toISOString(),
          riskScore: rift.riskScore,
        },
      }
    }

    // If event hasn't passed, not eligible
    return {
      eligible: false,
      reason: 'Event date has not passed yet',
      category: 'TICKETS',
      details: {
        eventDate: eventDate.toISOString(),
        now: now.toISOString(),
      },
    }
  }

  // No event date set - require buyer confirmation
  return {
    eligible: false,
    reason: 'Buyer confirmation required (no event date set)',
    category: 'TICKETS',
  }
}

/**
 * Release funds for a Rift
 * This checks eligibility and then processes the release
 */
export async function releaseFunds(
  riftId: string,
  requestMeta?: { ip?: string; userAgent?: string; deviceFingerprint?: string }
): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Check eligibility
    const eligibility = await computeReleaseEligibility(riftId)

    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reason || 'Not eligible for release',
        details: eligibility.details,
      }
    }

    // Get full rift data
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      include: {
        seller: {
          select: {
            id: true,
            stripeConnectAccountId: true,
          },
        },
      },
    })

    if (!rift) {
      return { success: false, error: 'Rift not found' }
    }

    // Mark as eligible if not already
    if (!rift.releaseEligibleAt) {
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: { releaseEligibleAt: new Date() },
      })
    }

    // Log RELEASE_ELIGIBLE event if not already logged
    const existingEvent = await prisma.rift_events.findFirst({
      where: {
        riftId,
        eventType: 'RELEASE_ELIGIBLE',
      },
    })

    if (!existingEvent) {
      await logEvent(
        riftId,
        RiftEventActorType.SYSTEM,
        null,
        'RELEASE_ELIGIBLE',
        {
          reason: eligibility.reason,
          category: eligibility.category,
          ...eligibility.details,
        },
        requestMeta
      )
    }

    // Update status to RELEASED
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    })

    // Log FUNDS_RELEASED event
    await logEvent(
      riftId,
      RiftEventActorType.SYSTEM,
      null,
      'FUNDS_RELEASED',
      {
        reason: eligibility.reason,
        sellerNet: rift.sellerNet,
        currency: rift.currency,
      },
      requestMeta
    )

    // Update risk metrics (successful transaction)
    try {
      const { updateMetricsOnFundsReleased } = await import('@/lib/risk/metrics')
      await updateMetricsOnFundsReleased(
        riftId,
        rift.buyerId,
        rift.sellerId,
        rift.subtotal || 0
      )
    } catch (error) {
      console.error(`Error updating risk metrics for rift ${riftId}:`, error)
      // Don't fail release if metrics update fails
    }

    // TODO: Trigger Stripe Connect payout if seller has Connect account
    // This should be handled by existing payout system from Phase 1/2

    return {
      success: true,
      details: {
        reason: eligibility.reason,
        releasedAt: new Date(),
      },
    }
  } catch (error: any) {
    console.error('Release funds error:', error)
    return {
      success: false,
      error: error.message || 'Failed to release funds',
    }
  }
}

