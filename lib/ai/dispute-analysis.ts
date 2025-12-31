/**
 * AI-Powered Dispute Resolution Assistance
 * 
 * Provides:
 * - NLP analysis of dispute text
 * - Sentiment analysis for credibility
 * - Automatic summarization
 * - Resolution outcome suggestions with confidence scores
 * - Evidence extraction and cross-referencing
 */

import { prisma } from '../prisma'
import OpenAI from 'openai'
import { createServerClient } from '../supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface DisputeAnalysis {
  summary: string
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative'
    credibility: number // 0-100
    emotionalIntensity: number // 0-100
  }
  keyFacts: string[]
  suggestedOutcome: 'buyer' | 'seller' | 'partial_refund' | 'needs_more_info' | 'unclear'
  confidenceScore: number // 0-100
  reasoning: string
  extractedEvidence: {
    mentionedProofs: string[]
    mentionedAmounts: string[]
    mentionedDates: string[]
    contradictions: string[]
  }
  flags: {
    frivolous: boolean
    legitimate: boolean
    requiresUrgentReview: boolean
    suspiciousPatterns: string[]
  }
}

/**
 * Analyze dispute text using NLP
 */
export async function analyzeDisputeText(
  disputeId: string,
  disputeText: string,
  riftId: string
): Promise<DisputeAnalysis> {
  // Get dispute and rift context
  const supabase = createServerClient()
  const { data: dispute } = await supabase
    .from('disputes')
    .select('reason, category_snapshot, summary')
    .eq('id', disputeId)
    .single()

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      id: true,
      itemType: true,
      itemTitle: true,
      itemDescription: true,
      subtotal: true,
      currency: true,
      buyerId: true,
      sellerId: true,
      status: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  // Get related evidence (messages, vault assets, events)
  const { data: evidence } = await supabase
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', disputeId)

  const vaultAssets = await prisma.vaultAsset.findMany({
    where: { riftId },
    select: {
      assetType: true,
      fileName: true,
      textContent: true,
      trackingNumber: true,
      createdAt: true,
    },
  })

  // Get conversation messages
  const { data: messages } = await supabase
    .from('messages')
    .select('body, sender_id, created_at')
    .eq('conversation_id', (await supabase
      .from('conversations')
      .select('id')
      .eq('transaction_id', riftId)
      .single()).data?.id || '')
    .order('created_at', { ascending: true })

  // Build context for AI analysis
  const context = {
    dispute: {
      reason: dispute?.reason,
      category: dispute?.category_snapshot,
      summary: disputeText,
    },
    transaction: {
      itemType: rift.itemType,
      title: rift.itemTitle,
      description: rift.itemDescription,
      amount: rift.subtotal,
      currency: rift.currency,
    },
    evidence: {
      vaultAssets: vaultAssets.map(a => ({
        type: a.assetType,
        fileName: a.fileName,
        content: a.textContent?.substring(0, 200),
        tracking: a.trackingNumber,
      })),
      messages: messages?.slice(-10).map(m => ({
        sender: m.sender_id,
        text: m.body.substring(0, 200),
      })),
    },
  }

  // Use AI to analyze the dispute
  const prompt = `You are an expert dispute resolution analyst for an escrow platform. Analyze this dispute and provide a comprehensive analysis.

Dispute Information:
- Reason: ${context.dispute.reason}
- Category: ${context.dispute.category}
- Summary: ${context.dispute.summary}

Transaction Details:
- Item Type: ${context.transaction.itemType}
- Title: ${context.transaction.title}
- Amount: ${context.transaction.currency} ${context.transaction.amount}
- Description: ${context.transaction.description.substring(0, 300)}

Evidence Available:
${JSON.stringify(context.evidence, null, 2)}

Analyze this dispute and provide a JSON response with:
{
  "summary": "A concise 2-3 sentence summary of the dispute",
  "sentiment": {
    "overall": "positive|neutral|negative",
    "credibility": 0-100,
    "emotionalIntensity": 0-100
  },
  "keyFacts": ["fact 1", "fact 2", "fact 3"],
  "suggestedOutcome": "buyer|seller|partial_refund|needs_more_info|unclear",
  "confidenceScore": 0-100,
  "reasoning": "2-3 sentence explanation of suggested outcome",
  "extractedEvidence": {
    "mentionedProofs": ["proof 1", "proof 2"],
    "mentionedAmounts": ["amount mentioned"],
    "mentionedDates": ["dates mentioned"],
    "contradictions": ["contradiction 1", "contradiction 2"]
  },
  "flags": {
    "frivolous": boolean,
    "legitimate": boolean,
    "requiresUrgentReview": boolean,
    "suspiciousPatterns": ["pattern 1", "pattern 2"]
  }
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert dispute resolution analyst. Provide accurate, unbiased analysis of disputes. Always respond with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent analysis
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}') as DisputeAnalysis

    // Validate and enhance analysis with actual evidence cross-referencing
    analysis.extractedEvidence = await crossReferenceEvidence(
      analysis.extractedEvidence,
      vaultAssets,
      messages || [],
      rift
    )

    return analysis
  } catch (error) {
    console.error('Dispute analysis failed:', error)
    
    // Fallback to basic analysis
    return {
      summary: disputeText.substring(0, 200),
      sentiment: {
        overall: 'neutral',
        credibility: 50,
        emotionalIntensity: 50,
      },
      keyFacts: [],
      suggestedOutcome: 'needs_more_info',
      confidenceScore: 0,
      reasoning: 'AI analysis unavailable - manual review required',
      extractedEvidence: {
        mentionedProofs: [],
        mentionedAmounts: [],
        mentionedDates: [],
        contradictions: [],
      },
      flags: {
        frivolous: false,
        legitimate: false,
        requiresUrgentReview: false,
        suspiciousPatterns: [],
      },
    }
  }
}

/**
 * Cross-reference extracted evidence with actual vault assets and messages
 */
async function crossReferenceEvidence(
  extracted: DisputeAnalysis['extractedEvidence'],
  vaultAssets: any[],
  messages: any[],
  rift: any
): Promise<DisputeAnalysis['extractedEvidence']> {
  const contradictions: string[] = []

  // Check if mentioned proofs actually exist
  const actualProofTypes = vaultAssets.map(a => a.assetType)
  const mentionedButMissing = extracted.mentionedProofs.filter(proof => {
    const proofLower = proof.toLowerCase()
    return !actualProofTypes.some(type => type.toLowerCase().includes(proofLower))
  })

  if (mentionedButMissing.length > 0) {
    contradictions.push(`Buyer mentions ${mentionedButMissing.join(', ')} but these proofs were not submitted`)
  }

  // Check if mentioned amounts match transaction
  extracted.mentionedAmounts.forEach(amount => {
    const amountNum = parseFloat(amount.replace(/[^0-9.]/g, ''))
    if (amountNum && Math.abs(amountNum - (rift.subtotal || 0)) > 10) {
      contradictions.push(`Mentioned amount (${amount}) does not match transaction amount (${rift.subtotal})`)
    }
  })

  // Check messages for contradictions
  const allMessageText = messages.map(m => m.body).join(' ')
  if (allMessageText) {
    // Simple check: if dispute says "seller didn't respond" but messages exist
    const textLower = allMessageText.toLowerCase()
    const hasUnresponsiveClaim = ['no response', 'didn\'t respond', 'ignored'].some(phrase => 
      textLower.includes(phrase.toLowerCase())
    )
    if (hasUnresponsiveClaim && messages.length > 0) {
      contradictions.push('Dispute claims seller was unresponsive but messages exist')
    }
  }

  return {
    ...extracted,
    contradictions: [...extracted.contradictions, ...contradictions],
  }
}

/**
 * Generate a dispute summary for admin review
 */
export async function generateDisputeSummary(disputeId: string): Promise<string> {
  const supabase = createServerClient()
  const { data: dispute } = await supabase
    .from('disputes')
    .select('summary, reason, category_snapshot, rift_id')
    .eq('id', disputeId)
    .single()

  if (!dispute) {
    throw new Error('Dispute not found')
  }

  const analysis = await analyzeDisputeText(disputeId, dispute.summary, dispute.rift_id)

  // Generate formatted summary
  const summary = `
# Dispute Analysis Summary

**Suggested Outcome:** ${analysis.suggestedOutcome.replace('_', ' ').toUpperCase()} (${analysis.confidenceScore}% confidence)

**Key Facts:**
${analysis.keyFacts.map(f => `- ${f}`).join('\n')}

**Reasoning:**
${analysis.reasoning}

**Evidence Status:**
- Proofs Mentioned: ${analysis.extractedEvidence.mentionedProofs.length > 0 ? analysis.extractedEvidence.mentionedProofs.join(', ') : 'None'}
${analysis.extractedEvidence.contradictions.length > 0 ? `\n**Contradictions:**\n${analysis.extractedEvidence.contradictions.map(c => `- ${c}`).join('\n')}` : ''}

**Flags:**
${analysis.flags.frivolous ? '- ⚠️ Frivolous dispute detected' : ''}
${analysis.flags.legitimate ? '- ✓ Legitimate dispute' : ''}
${analysis.flags.requiresUrgentReview ? '- 🚨 Requires urgent review' : ''}
${analysis.flags.suspiciousPatterns.length > 0 ? `- ⚠️ Suspicious patterns: ${analysis.flags.suspiciousPatterns.join(', ')}` : ''}

**Sentiment Analysis:**
- Credibility: ${analysis.sentiment.credibility}/100
- Emotional Intensity: ${analysis.sentiment.emotionalIntensity}/100
- Overall Sentiment: ${analysis.sentiment.overall}
`.trim()

  return summary
}

