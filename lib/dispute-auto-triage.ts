/**
 * Auto-Triage Engine for Disputes
 * 
 * Analyzes objective signals from rift_events, delivery_views, and other
 * system logs to automatically reject obvious abuse cases or flag for review.
 */

import { prisma } from './prisma'
import { createServerClient } from './supabase'

export interface AutoTriageResult {
  decision: 'auto_reject' | 'needs_review'
  signals: {
    buyerConfirmedReceipt?: boolean
    deliveryDownloaded?: boolean
    deliverySecondsViewed?: number
    ticketBuyerConfirmed?: boolean
    ticketEventPassed?: boolean
    serviceBuyerConfirmed?: boolean
    hoursSinceDelivery?: number
    highAbuseRisk?: boolean
    [key: string]: any
  }
  rationale: string
}

/**
 * Auto-triage a dispute based on objective signals
 */
export async function autoTriageDispute(
  riftId: string,
  reason: string,
  category: string
): Promise<AutoTriageResult> {
  const signals: AutoTriageResult['signals'] = {}
  let decision: 'auto_reject' | 'needs_review' = 'needs_review'
  let rationale = ''

  // Get rift details
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      itemType: true,
      eventDateTz: true,
      buyerId: true,
      sellerId: true,
      riskScore: true,
    },
  })

  if (!rift) {
    return {
      decision: 'needs_review',
      signals: {},
      rationale: 'Rift not found',
    }
  }

  // Check if buyer confirmed receipt
  const buyerConfirmedEvent = await prisma.riftEvent.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_RECEIPT',
    },
  })
  signals.buyerConfirmedReceipt = !!buyerConfirmedEvent

  // Category-specific checks
  switch (category) {
    case 'DIGITAL':
      return await triageDigitalGoods(riftId, reason, signals)
    
    case 'SERVICES':
      return await triageServices(riftId, reason, signals)
    
    case 'TICKETS':
      return await triageTickets(riftId, reason, signals, rift.eventDateTz)
    
    default:
      return {
        decision: 'needs_review',
        signals,
        rationale: 'Category not supported for auto-triage',
      }
  }
}

/**
 * Triage digital goods disputes
 */
async function triageDigitalGoods(
  riftId: string,
  reason: string,
  signals: AutoTriageResult['signals']
): Promise<AutoTriageResult> {
  const supabase = createServerClient()

  // Check delivery views
  const { data: views } = await supabase
    .from('delivery_views')
    .select('downloaded, seconds_viewed')
    .eq('rift_id', riftId)

  const hasDownloaded = views?.some(v => v.downloaded === true) || false
  const maxSecondsViewed = views?.reduce((max, v) => Math.max(max, v.seconds_viewed || 0), 0) || 0

  signals.deliveryDownloaded = hasDownloaded
  signals.deliverySecondsViewed = maxSecondsViewed

  // Check delivery upload time
  const { data: delivery } = await supabase
    .from('digital_deliveries')
    .select('uploaded_at')
    .eq('rift_id', riftId)
    .single()

  if (delivery) {
    const uploadTime = new Date(delivery.uploaded_at)
    const now = new Date()
    signals.hoursSinceDelivery = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60)
  }

  // Auto-reject rules for digital goods
  if (reason === 'not_received') {
    if (hasDownloaded) {
      return {
        decision: 'auto_reject',
        signals,
        rationale: 'Buyer downloaded the delivery in Rift. Evidence shows access occurred.',
      }
    }

    if (maxSecondsViewed >= 30) {
      return {
        decision: 'auto_reject',
        signals,
        rationale: 'Buyer viewed the delivery for 30+ seconds in Rift. Evidence shows access occurred.',
      }
    }
  }

  // If buyer confirmed receipt, auto-reject for not_received
  if (signals.buyerConfirmedReceipt && reason === 'not_received') {
    return {
      decision: 'auto_reject',
      signals,
      rationale: 'Buyer previously confirmed receipt of the digital delivery.',
    }
  }

  return {
    decision: 'needs_review',
    signals,
    rationale: 'Requires manual review. No strong signals for auto-rejection.',
  }
}

/**
 * Triage services disputes
 */
async function triageServices(
  riftId: string,
  reason: string,
  signals: AutoTriageResult['signals']
): Promise<AutoTriageResult> {
  // Check if buyer confirmed completion
  const confirmedEvent = await prisma.riftEvent.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_RECEIPT',
    },
  })

  signals.serviceBuyerConfirmed = !!confirmedEvent

  // If buyer confirmed completion, auto-reject for most reasons
  if (confirmedEvent) {
    if (reason === 'not_received' || reason === 'not_as_described') {
      return {
        decision: 'auto_reject',
        signals,
        rationale: 'Buyer previously confirmed service completion. Cannot dispute after confirmation.',
      }
    }

    // For unauthorized, still needs review but flag it
    if (reason === 'unauthorized') {
      return {
        decision: 'needs_review',
        signals: { ...signals, highAbuseRisk: true },
        rationale: 'Buyer confirmed completion but claims unauthorized. Requires review.',
      }
    }
  }

  return {
    decision: 'needs_review',
    signals,
    rationale: 'Requires manual review.',
  }
}

/**
 * Triage tickets disputes
 */
async function triageTickets(
  riftId: string,
  reason: string,
  signals: AutoTriageResult['signals'],
  eventDateTz: Date | null
): Promise<AutoTriageResult> {
  // Check if event date passed
  if (eventDateTz) {
    const eventDate = new Date(eventDateTz)
    const now = new Date()
    signals.ticketEventPassed = now >= eventDate

    // This should be blocked in UX, but check here too
    if (now >= eventDate) {
      return {
        decision: 'auto_reject',
        signals,
        rationale: 'Event date has passed. Disputes are not allowed after the event.',
      }
    }
  }

  // Check if buyer confirmed ticket receipt
  const confirmedEvent = await prisma.riftEvent.findFirst({
    where: {
      riftId,
      eventType: 'BUYER_CONFIRMED_TICKET_RECEIPT',
    },
  })

  signals.ticketBuyerConfirmed = !!confirmedEvent

  if (confirmedEvent && reason === 'not_received') {
    return {
      decision: 'auto_reject',
      signals,
      rationale: 'Buyer previously confirmed receipt of the ticket in their account.',
    }
  }

  const supabase = createServerClient()
  const { data: transfer } = await supabase
    .from('ticket_transfers')
    .select('seller_claimed_sent_at, buyer_confirmed_received_at, status')
    .eq('rift_id', riftId)
    .single()

  if (transfer?.buyer_confirmed_received_at && reason === 'not_received') {
    return {
      decision: 'auto_reject',
      signals: { ...signals, ticketBuyerConfirmed: true },
      rationale: 'Buyer confirmed ticket receipt. Evidence shows transfer was received.',
    }
  }

  return {
    decision: 'needs_review',
    signals,
    rationale: 'Requires manual review.',
  }
}

/**
 * Check if user has excessive disputes (abuse risk)
 */
export async function checkAbuseRisk(userId: string): Promise<{
  highRisk: boolean
  disputeCount: number
  recentDisputes: number
}> {
  const supabase = createServerClient()

  // Count total disputes opened by user
  const { data: allDisputes, count: totalCount } = await supabase
    .from('disputes')
    .select('id, status, created_at', { count: 'exact' })
    .eq('opened_by', userId)

  if (!allDisputes) {
    return { highRisk: false, disputeCount: 0, recentDisputes: 0 }
  }

  // Count disputes in last 60 days
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  
  const recentDisputes = allDisputes.filter(
    d => new Date(d.created_at) >= sixtyDaysAgo
  ).length

  // Count auto-rejected disputes (likely abuse)
  const { data: autoRejected } = await supabase
    .from('disputes')
    .select('id')
    .eq('opened_by', userId)
    .eq('status', 'auto_rejected')

  const autoRejectedCount = autoRejected?.length || 0

  // High risk if:
  // - 3+ disputes in 60 days, OR
  // - 2+ auto-rejected disputes
  const highRisk = recentDisputes >= 3 || autoRejectedCount >= 2

  return {
    highRisk,
    disputeCount: totalCount || 0,
    recentDisputes,
  }
}

