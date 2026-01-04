/**
 * Dispute Triage System
 * Auto-routes disputes to auto-refund, auto-deny, or manual review
 */

import { prisma } from '../prisma'
import { createServerClient } from '../supabase'

export type TriageDecision = 'AUTO_REFUND' | 'AUTO_DENY' | 'MANUAL_REVIEW'

export interface TriageResult {
  decision: TriageDecision
  confidence: number // 0-100
  reasoning: string[]
  evidence: {
    forBuyer: string[]
    forSeller: string[]
  }
  recommendation: string
}

/**
 * Triage a dispute based on evidence strength
 */
export async function triageDispute(
  disputeId: string,
  riftId: string
): Promise<TriageResult> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      buyer: { select: { id: true } },
      seller: { select: { id: true } },
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  // Get dispute details (from Supabase)
  // Simplified - would need actual dispute fetch
  const disputeReason = 'not_received' // Would come from dispute

  // Get evidence
  const evidence = await gatherEvidence(riftId, disputeReason)

  // Analyze evidence strength
  const buyerEvidenceStrength = evidence.forBuyer.length
  const sellerEvidenceStrength = evidence.forSeller.length

  // Get vault access logs
  const accessLogs = await prisma.vault_events.findMany({
    where: {
      riftId,
      eventType: 'BUYER_OPENED_ASSET',
      actorRole: 'BUYER',
    },
  })

  // Reason matching logic
  let decision: TriageDecision
  let confidence = 50
  const reasoning: string[] = []

  if (disputeReason === 'not_received') {
    // Check if buyer accessed the vault
    if (accessLogs.length > 0) {
      decision = 'AUTO_DENY'
      confidence = 90
      reasoning.push('Buyer accessed vault assets - proof of delivery exists')
      evidence.forSeller.push(`Buyer opened vault ${accessLogs.length} time(s)`)
    } else if (sellerEvidenceStrength === 0) {
      decision = 'AUTO_REFUND'
      confidence = 80
      reasoning.push('No proof of delivery found - seller failed to provide evidence')
      evidence.forBuyer.push('No vault access logs found')
    } else {
      decision = 'MANUAL_REVIEW'
      confidence = 60
      reasoning.push('Conflicting evidence - requires human review')
    }
  } else if (disputeReason === 'not_as_described') {
    // Check proof quality and type matching
    const proofAssets = await prisma.vault_assets.findMany({
      where: { riftId },
    })

    if (proofAssets.length === 0) {
      decision = 'AUTO_REFUND'
      confidence = 85
      reasoning.push('No proof submitted by seller')
    } else {
      // Would check proof classification here
      decision = 'MANUAL_REVIEW'
      confidence = 70
      reasoning.push('Proof submitted but quality/type needs verification')
    }
  } else {
    // Other reasons - default to manual review
    decision = 'MANUAL_REVIEW'
    confidence = 50
    reasoning.push('Complex dispute - requires manual review')
  }

  // Generate recommendation
  const recommendation = generateRecommendation(decision, evidence, reasoning)

  return {
    decision,
    confidence,
    reasoning,
    evidence,
    recommendation,
  }
}

/**
 * Gather evidence for both sides
 */
async function gatherEvidence(
  riftId: string,
  disputeReason: string
): Promise<{
  forBuyer: string[]
  forSeller: string[]
}> {
  const forBuyer: string[] = []
  const forSeller: string[] = []

  // Check vault access logs
  const buyerAccess = await prisma.vault_events.findMany({
    where: {
      riftId,
      actorRole: 'BUYER',
      eventType: 'BUYER_OPENED_ASSET',
    },
  })

  if (buyerAccess.length === 0) {
    forBuyer.push('No evidence of buyer accessing delivery')
  } else {
    forSeller.push(`Buyer accessed vault ${buyerAccess.length} time(s)`)
  }

  // Check proof submission
  const proofAssets = await prisma.vault_assets.findMany({
    where: { riftId },
  })

  if (proofAssets.length === 0) {
    forBuyer.push('No proof of delivery submitted')
  } else {
    forSeller.push(`${proofAssets.length} proof asset(s) submitted`)
  }

  // Check timeline events
  const timelineEvents = await prisma.timelineEvent.findMany({
    where: { escrowId: riftId },
    orderBy: { createdAt: 'asc' },
  })

  const proofSubmitted = timelineEvents.some(e => e.type === 'PROOF_SUBMITTED')
  if (proofSubmitted) {
    forSeller.push('Proof submitted on timeline')
  } else {
    forBuyer.push('No proof submission recorded')
  }

  // Get rift to check buyer
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: { buyerId: true },
  })

  if (rift) {
    // Check dispute history
    // Get all rifts where buyer is the buyerId
    const buyerRifts = await prisma.riftTransaction.findMany({
      where: {
        buyerId: rift.buyerId,
      },
      select: {
        id: true,
      },
    })

    const buyerRiftIds = buyerRifts.map(r => r.id)
    
    // Query disputes from Supabase
    let pastDisputes = 0
    try {
      const supabase = createServerClient()
      if (buyerRiftIds.length > 0) {
        const { data: disputes, error } = await supabase
          .from('disputes')
          .select('id')
          .in('rift_id', buyerRiftIds)
          .eq('opened_by', rift.buyerId)
        
        if (!error && disputes) {
          pastDisputes = disputes.length
        }
      }
    } catch (supabaseError) {
      // If Supabase is not configured, skip dispute count
      console.warn('Supabase not configured or error fetching Dispute:', supabaseError)
    }

    if (pastDisputes >= 3) {
      forSeller.push(`Buyer has ${pastDisputes} previous disputes`)
    }
  }

  return { forBuyer, forSeller }
}

/**
 * Generate recommendation text
 */
function generateRecommendation(
  decision: TriageDecision,
  evidence: { forBuyer: string[]; forSeller: string[] },
  reasoning: string[]
): string {
  switch (decision) {
    case 'AUTO_REFUND':
      return `Strong evidence supports buyer. ${reasoning.join(' ')} Recommend full refund.`
    case 'AUTO_DENY':
      return `Strong evidence supports seller. ${reasoning.join(' ')} Recommend deny dispute.`
    case 'MANUAL_REVIEW':
      return `Conflicting evidence requires human review. Buyer evidence: ${evidence.forBuyer.length} points. Seller evidence: ${evidence.forSeller.length} points.`
  }
}

/**
 * Generate decision assistant summary for admins
 */
export async function generateDecisionAssistant(
  disputeId: string,
  riftId: string
): Promise<{
  buyerEvidence: string[]
  sellerEvidence: string[]
  strongestEvidence: {
    buyer: string
    seller: string
  }
  recommendedOutcome: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'DENY' | 'REQUIRES_REVIEW'
  reasoning: string
}> {
  const triage = await triageDispute(disputeId, riftId)

  const strongestBuyer = triage.evidence.forBuyer[0] || 'No strong evidence'
  const strongestSeller = triage.evidence.forSeller[0] || 'No strong evidence'

  let recommendedOutcome: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'DENY' | 'REQUIRES_REVIEW'
  if (triage.decision === 'AUTO_REFUND') {
    recommendedOutcome = 'FULL_REFUND'
  } else if (triage.decision === 'AUTO_DENY') {
    recommendedOutcome = 'DENY'
  } else {
    recommendedOutcome = 'REQUIRES_REVIEW'
  }
    
    return {
    buyerEvidence: triage.evidence.forBuyer,
    sellerEvidence: triage.evidence.forSeller,
    strongestEvidence: {
      buyer: strongestBuyer,
      seller: strongestSeller,
    },
    recommendedOutcome,
    reasoning: triage.recommendation,
  }
}
