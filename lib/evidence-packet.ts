/**
 * Evidence Packet Generation
 * 
 * Generates comprehensive evidence packets for chargebacks/disputes.
 * Produces JSON (machine-readable) and can be rendered as HTML for humans.
 */

import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { formatDistanceToNowStrict } from 'date-fns'

/**
 * Redact email address for privacy
 */
function redactEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const [local, domain] = email.split('@')
  if (!domain) return email
  
  const redactedLocal = local.length > 2 
    ? `${local[0]}***${local[local.length - 1]}`
    : '***'
  const [domainName, ...domainParts] = domain.split('.')
  const redactedDomain = domainName.length > 2
    ? `${domainName[0]}***${domainName[domainName.length - 1]}`
    : '***'
  
  return `${redactedLocal}@${redactedDomain}.${domainParts.join('.')}`
}

/**
 * Generate evidence packet for a rift
 */
export async function generateEvidencePacket(
  riftId: string,
  stripeDisputeId?: string
): Promise<any> {
  // Get rift with all related data
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      buyer: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      },
      seller: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      },
        rift_events: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          eventType: true,
          actorType: true,
          actorId: true,
          payload: true,
          createdAt: true,
        },
      },
      TimelineEvent: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          message: true,
          createdAt: true,
        },
      },
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  const supabase = createServerClient()

  // Get risk profiles
  const { data: buyerRisk } = await supabase
    .from('risk_profiles')
    .select('buyer_risk_score, seller_risk_score')
    .eq('user_id', rift.buyerId)
    .maybeSingle()

  const { data: sellerRisk } = await supabase
    .from('risk_profiles')
    .select('buyer_risk_score, seller_risk_score')
    .eq('user_id', rift.sellerId)
    .maybeSingle()

  // Get policy acceptances
  const { data: buyerAcceptances } = await supabase
    .from('policy_acceptances')
    .select('*')
    .eq('user_id', rift.buyerId)
    .in('context', ['signup', 'checkout'])
    .order('accepted_at', { ascending: false })

  // Get delivery proof (category-specific)
  let deliveryProof: any = null
  if (rift.itemType === 'DIGITAL_GOODS') {
    const { data: digitalDeliveries } = await supabase
      .from('digital_deliveries')
      .select('*')
      .eq('rift_id', riftId)
      .order('uploaded_at', { ascending: false })

    const { data: deliveryViews } = await supabase
      .from('delivery_views')
      .select('*')
      .eq('rift_id', riftId)
      .order('created_at', { ascending: false })

    if (digitalDeliveries && digitalDeliveries.length > 0) {
      const latest = digitalDeliveries[0]
      const views = deliveryViews || []
      const totalSessions = views.length
      const maxSeconds = views.reduce((max, v) => Math.max(max, v.seconds_viewed || 0), 0)
      const downloaded = views.some(v => v.downloaded === true)
      const firstViewed = views.length > 0 ? views[views.length - 1].created_at : null
      const lastViewed = views.length > 0 ? views[0].created_at : null

      deliveryProof = {
        type: 'digital',
        file_name: latest.file_name,
        mime_type: latest.mime_type,
        uploaded_at: latest.uploaded_at,
        delivery_views: {
          total_sessions: totalSessions,
          max_seconds_viewed: maxSeconds,
          downloaded: downloaded,
          first_viewed_at: firstViewed,
          last_viewed_at: lastViewed,
        },
      }
    }
  } else if (rift.itemType === 'SERVICES') {
    // Find service delivery events
    const serviceDelivered = rift.rift_events.find(
      e => e.eventType === 'SERVICE_MARKED_DELIVERED' || e.eventType === 'SERVICE_DELIVERED'
    )
    const serviceConfirmed = rift.rift_events.find(
      e => e.eventType === 'SERVICE_CONFIRMED' || e.eventType === 'BUYER_CONFIRMED_COMPLETION'
    )

    deliveryProof = {
      type: 'service',
      seller_marked_delivered_at: serviceDelivered?.createdAt.toISOString() || null,
      buyer_confirmed_at: serviceConfirmed?.createdAt.toISOString() || null,
    }
  } else if (rift.itemType === 'OWNERSHIP_TRANSFER') {
    const { data: ticketTransfers } = await supabase
      .from('ticket_transfers')
      .select('*')
      .eq('rift_id', riftId)
      .order('created_at', { ascending: false })

    if (ticketTransfers && ticketTransfers.length > 0) {
      const transfer = ticketTransfers[0]
      deliveryProof = {
        type: 'ticket',
        provider: transfer.provider,
        transfer_to_email: redactEmail(transfer.transfer_to_email),
        seller_claimed_sent_at: transfer.seller_claimed_sent_at,
        buyer_confirmed_received_at: transfer.buyer_confirmed_received_at,
        status: transfer.status,
        event_date: rift.eventDateTz?.toISOString() || rift.eventDate,
        rule_note: 'Disputes disabled after event_date per platform policy',
      }
    }
  }

  // Get chat transcript (from Supabase messages)
  const { data: conversationData } = await supabase
    .from('conversations')
    .select('id')
    .eq('rift_id', riftId)
    .maybeSingle()

  let chatTranscript: any[] = []
  if (conversationData) {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationData.id)
      .order('created_at', { ascending: true })

    chatTranscript = (messages || []).map((msg: any) => ({
      id: msg.id,
      sender_id: msg.sender_id,
      body: msg.body,
      created_at: msg.created_at,
      is_system: msg.is_system || false,
    }))
  }

  // Get platform disputes
  const { data: disputes } = await supabase
    .from('disputes')
    .select('*')
    .eq('rift_id', riftId)
    .order('created_at', { ascending: false })

  let disputeHistory: any[] = []
  if (disputes && disputes.length > 0) {
    for (const dispute of disputes) {
      const { data: actions } = await supabase
        .from('dispute_actions')
        .select('*')
        .eq('dispute_id', dispute.id)
        .order('created_at', { ascending: true })

      const { data: evidence } = await supabase
        .from('dispute_evidence')
        .select('id, type, uploader_role, created_at')
        .eq('dispute_id', dispute.id)

      disputeHistory.push({
        id: dispute.id,
        reason: dispute.reason,
        status: dispute.status,
        created_at: dispute.created_at,
        resolved_at: dispute.status === 'resolved_buyer' || dispute.status === 'resolved_seller' 
          ? dispute.updated_at 
          : null,
        actions: (actions || []).map((a: any) => ({
          action_type: a.action_type,
          actor_role: a.actor_role,
          note: a.note,
          created_at: a.created_at,
        })),
        evidence_count: evidence?.length || 0,
        evidence_types: evidence?.map((e: any) => e.type) || [],
      })
    }
  }

  // Build event timeline (safe subset of events)
  const eventTimeline = rift.rift_events.map((e: any) => ({
    event_type: e.eventType,
    actor_type: e.actorType,
    actor_id: e.actorId,
    created_at: e.createdAt.toISOString(),
    // Include safe payload subset (exclude user content)
    payload_safe: {
      // Only include structural data, not user-generated content
      ...(e.payload && typeof e.payload === 'object' 
        ? Object.fromEntries(
            Object.entries(e.payload).filter(([key]) => 
              !['message', 'body', 'text', 'content'].includes(key.toLowerCase())
            )
          )
        : {}),
    },
  }))

  // Generate conclusion summary
  const conclusionSummary = generateConclusionSummary(rift, deliveryProof, chatTranscript)

  // Build packet
  const packet = {
    packet_meta: {
      generated_at: new Date().toISOString(),
      packet_version: 'v1',
      rift_id: riftId,
      stripe_dispute_id: stripeDisputeId || null,
    },
    transaction_summary: {
      rift_title: rift.itemTitle,
      rift_description: rift.itemDescription,
      category: rift.itemType,
      amount: rift.subtotal,
      currency: rift.currency,
      status: rift.status,
      created_at: rift.createdAt.toISOString(),
      paid_at: rift.paidAt?.toISOString() || null,
      delivered_at: rift.deliveryVerifiedAt?.toISOString() || null,
      released_at: rift.releasedAt?.toISOString() || null,
      event_date: rift.eventDateTz?.toISOString() || rift.eventDate || null,
    },
    identities: {
      buyer_id: rift.buyerId,
      buyer_email: redactEmail(rift.buyer.email),
      buyer_account_age_days: Math.floor(
        (Date.now() - new Date(rift.buyer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
      seller_id: rift.sellerId,
      seller_email: redactEmail(rift.seller.email),
      seller_account_age_days: Math.floor(
        (Date.now() - new Date(rift.seller.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
      risk_scores: {
        rift_risk_score: rift.riskScore || 0,
        buyer_risk_score: buyerRisk?.buyer_risk_score || 0,
        seller_risk_score: sellerRisk?.seller_risk_score || 0,
      },
    },
    payment_details: {
      stripe_payment_intent_id: rift.stripePaymentIntentId,
      stripe_charge_id: rift.stripeChargeId,
      stripe_customer_id: rift.stripeCustomerId,
      paid_at: rift.paidAt?.toISOString() || null,
    },
    policy_acceptances: (buyerAcceptances || []).map((acc: any) => ({
      context: acc.context,
      policy_version: acc.policy_version,
      accepted_at: acc.accepted_at,
    })),
    delivery_proof: deliveryProof,
    chat_transcript: chatTranscript,
    dispute_history: disputeHistory,
    event_timeline: eventTimeline,
    conclusion_summary: conclusionSummary,
  }

  return packet
}

/**
 * Generate conclusion summary from facts
 */
function generateConclusionSummary(
  rift: any,
  deliveryProof: any,
  chatTranscript: any[]
): string {
  const lines: string[] = []

  if (rift.paidAt) {
    lines.push(`Payment succeeded on ${new Date(rift.paidAt).toISOString()}.`)
  }

  if (deliveryProof) {
    if (deliveryProof.type === 'digital') {
      lines.push(`Digital delivery uploaded on ${deliveryProof.uploaded_at}.`)
      if (deliveryProof.delivery_views) {
        const views = deliveryProof.delivery_views
        lines.push(
          `Buyer viewed delivery for ${views.max_seconds_viewed} seconds across ${views.total_sessions} session(s).`
        )
        lines.push(`Downloaded: ${views.downloaded ? 'Yes' : 'No'}.`)
        if (views.first_viewed_at) {
          lines.push(`First viewed: ${views.first_viewed_at}.`)
        }
        if (views.last_viewed_at) {
          lines.push(`Last viewed: ${views.last_viewed_at}.`)
        }
      }
    } else if (deliveryProof.type === 'service') {
      if (deliveryProof.seller_marked_delivered_at) {
        lines.push(`Service marked delivered on ${deliveryProof.seller_marked_delivered_at}.`)
      }
      if (deliveryProof.buyer_confirmed_at) {
        lines.push(`Buyer confirmed completion on ${deliveryProof.buyer_confirmed_at}.`)
      }
    } else if (deliveryProof.type === 'ticket') {
      if (deliveryProof.seller_claimed_sent_at) {
        lines.push(`Seller claimed transfer sent on ${deliveryProof.seller_claimed_sent_at}.`)
      }
      if (deliveryProof.buyer_confirmed_received_at) {
        lines.push(`Buyer confirmed receipt on ${deliveryProof.buyer_confirmed_received_at}.`)
      }
      if (deliveryProof.event_date) {
        lines.push(`Event date: ${deliveryProof.event_date}.`)
      }
    }
  }

  if (rift.deliveryVerifiedAt) {
    lines.push(`Buyer confirmed receipt on ${rift.deliveryVerifiedAt.toISOString()}.`)
  }

  if (chatTranscript.length > 0) {
    lines.push(`Chat transcript contains ${chatTranscript.length} message(s).`)
  }

  return lines.join(' ')
}

/**
 * Save evidence packet to database
 */
export async function saveEvidencePacket(
  riftId: string,
  packet: any,
  generatedBy?: string,
  stripeDisputeId?: string
): Promise<string> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('evidence_packets')
    .insert({
      rift_id: riftId,
      stripe_dispute_id: stripeDisputeId || null,
      generated_by: generatedBy || null,
      version: 'v1',
      payload: packet,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to save evidence packet: ${error.message}`)
  }

  return data.id
}

