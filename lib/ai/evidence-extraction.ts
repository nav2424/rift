/**
 * AI-Powered Dispute Evidence Extraction and Summarization
 * 
 * Features:
 * - Extract key facts from dispute submissions
 * - Summarize evidence packets for admins
 * - Cross-reference evidence across multiple sources
 * - Identify contradictions automatically
 */

import { prisma } from '../prisma'
import OpenAI from 'openai'
import { createServerClient } from '../supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface EvidenceSummary {
  keyFacts: Array<{
    fact: string
    source: string
    confidence: number
  }>
  timeline: Array<{
    date: string
    event: string
    source: string
  }>
  contradictions: Array<{
    contradiction: string
    sources: string[]
    severity: 'low' | 'medium' | 'high'
  }>
  summary: string
  recommendedActions: string[]
}

/**
 * Extract and summarize evidence for a dispute
 */
export async function extractAndSummarizeEvidence(
  disputeId: string,
  riftId: string
): Promise<EvidenceSummary> {
  const supabase = createServerClient()

  // Get all evidence
  const { data: dispute } = await supabase
    .from('disputes')
    .select('summary, reason')
    .eq('id', disputeId)
    .single()

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      itemType: true,
      itemTitle: true,
      itemDescription: true,
      subtotal: true,
      currency: true,
      createdAt: true,
      fundedAt: true,
      proofSubmittedAt: true,
    },
  })

  const vaultAssets = await prisma.vaultAsset.findMany({
    where: { riftId },
    select: {
      assetType: true,
      fileName: true,
      textContent: true,
      trackingNumber: true,
      createdAt: true,
      metadataJson: true,
    },
  })

  const { data: messages } = await supabase
    .from('messages')
    .select('body, sender_id, created_at')
    .eq('conversation_id', (await supabase
      .from('conversations')
      .select('id')
      .eq('transaction_id', riftId)
      .single()).data?.id || '')

  const events = await prisma.riftEvent.findMany({
    where: { riftId },
    select: {
      eventType: true,
      createdAt: true,
      payload: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Build evidence context for AI
  const evidenceContext = {
    dispute: {
      reason: dispute?.reason,
      summary: dispute?.summary,
    },
    transaction: {
      itemType: rift?.itemType,
      title: rift?.itemTitle,
      amount: rift?.subtotal,
      currency: rift?.currency,
      timeline: {
        created: rift?.createdAt,
        funded: rift?.fundedAt,
        proofSubmitted: rift?.proofSubmittedAt,
      },
    },
    vaultAssets: vaultAssets.map(a => ({
      type: a.assetType,
      fileName: a.fileName,
      content: a.textContent?.substring(0, 500),
      tracking: a.trackingNumber,
      submittedAt: a.createdAt,
    })),
    messages: messages?.slice(-20).map(m => ({
      sender: m.sender_id,
      text: m.body.substring(0, 300),
      timestamp: m.created_at,
    })),
    events: events.map(e => ({
      type: e.eventType,
      timestamp: e.createdAt,
      data: e.payload,
    })),
  }

  // Use AI to extract and summarize
  const prompt = `Extract and summarize evidence from this dispute case:

Dispute: ${dispute?.reason} - ${dispute?.summary || 'No summary'}

Transaction: ${JSON.stringify(evidenceContext.transaction, null, 2)}

Evidence:
${JSON.stringify({
    vaultAssets: evidenceContext.vaultAssets,
    messages: evidenceContext.messages,
    events: evidenceContext.events,
  }, null, 2)}

Provide a comprehensive evidence summary in JSON:

Dispute: ${dispute?.reason} - ${dispute?.summary}

Transaction: ${JSON.stringify(evidenceContext.transaction, null, 2)}

Evidence:
${JSON.stringify(evidenceContext, null, 2)}

Provide a comprehensive evidence summary in JSON:
{
  "keyFacts": [
    {"fact": "fact description", "source": "vault_asset|message|event|dispute", "confidence": 0-100}
  ],
  "timeline": [
    {"date": "YYYY-MM-DD", "event": "event description", "source": "source"}
  ],
  "contradictions": [
    {"contradiction": "description of contradiction", "sources": ["source1", "source2"], "severity": "low|medium|high"}
  ],
  "summary": "2-3 paragraph executive summary",
  "recommendedActions": ["action 1", "action 2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing legal/commercial evidence. Extract key facts, identify contradictions, and provide clear summaries.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const summary = JSON.parse(completion.choices[0].message.content || '{}') as EvidenceSummary

    // Enhance with cross-referencing
    summary.contradictions = [
      ...summary.contradictions,
      ...(await crossReferenceEvidence(evidenceContext)),
    ]

    return summary
  } catch (error) {
    console.error('Evidence extraction failed:', error)
    
    // Basic fallback
    return {
      keyFacts: [],
      timeline: [],
      contradictions: [],
      summary: 'Evidence analysis unavailable - manual review required',
      recommendedActions: ['Review all evidence manually'],
    }
  }
}

/**
 * Cross-reference evidence to find contradictions
 */
async function crossReferenceEvidence(context: any): Promise<EvidenceSummary['contradictions']> {
  const contradictions: EvidenceSummary['contradictions'] = []

  const disputeSummary = context.dispute?.summary || ''
  const proofSubmitted = context.transaction?.timeline?.proofSubmitted

  // Check if proof submission timing matches dispute claims
  if (disputeSummary.toLowerCase().includes('never received') && proofSubmitted) {
    contradictions.push({
      contradiction: 'Buyer claims item never received, but proof was submitted',
      sources: ['dispute', 'transaction_timeline'],
      severity: 'high',
    })
  }

  // Check if messages contradict dispute claims
  if (disputeSummary.toLowerCase().includes('no response') && context.messages && context.messages.length > 0) {
    contradictions.push({
      contradiction: 'Buyer claims seller was unresponsive, but messages exist',
      sources: ['dispute', 'messages'],
      severity: 'medium',
    })
  }

  // Check for amount mismatches
  const amountsMentioned = extractAmounts(disputeSummary)
  if (amountsMentioned.length > 0 && context.transaction?.amount) {
    const transactionAmount = context.transaction.amount
    const mismatch = amountsMentioned.find(a => Math.abs(a - transactionAmount) > 10)
    if (mismatch) {
      contradictions.push({
        contradiction: `Dispute mentions amount $${mismatch} but transaction is $${transactionAmount}`,
        sources: ['dispute', 'transaction'],
        severity: 'medium',
      })
    }
  }

  return contradictions
}

/**
 * Extract monetary amounts from text
 */
function extractAmounts(text: string): number[] {
  const amountRegex = /\$?(\d+(?:\.\d{2})?)/g
  const matches = text.match(amountRegex) || []
  return matches.map(m => parseFloat(m.replace('$', ''))).filter(n => !isNaN(n))
}

