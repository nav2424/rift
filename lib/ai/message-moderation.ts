/**
 * AI-Powered Message Content Moderation
 * 
 * Detects:
 * - Harassment and threats
 * - Spam and phishing attempts
 * - Off-platform transaction requests
 * - Suspicious communication patterns
 * - Sentiment analysis for early dispute detection
 */

import OpenAI from 'openai'
import { prisma } from '../prisma'
import { createServerClient } from '../supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ModerationResult {
  safe: boolean
  flags: {
    harassment: boolean
    threats: boolean
    spam: boolean
    phishing: boolean
    offPlatformRequest: boolean
    suspiciousPattern: boolean
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  action: 'allow' | 'flag' | 'block' | 'alert'
  reasoning: string
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative'
    intensity: number // 0-100
  }
  extractedEntities: {
    phoneNumbers: string[]
    emailAddresses: string[]
    urls: string[]
    paymentMethods: string[]
  }
}

/**
 * Moderate a single message
 */
export async function moderateMessage(
  messageText: string,
  context?: {
    conversationId?: string
    senderId?: string
    receiverId?: string
    riftId?: string
  }
): Promise<ModerationResult> {
  const flags = {
    harassment: false,
    threats: false,
    spam: false,
    phishing: false,
    offPlatformRequest: false,
    suspiciousPattern: false,
  }

  let severity: ModerationResult['severity'] = 'low'
  let action: ModerationResult['action'] = 'allow'
  let reasoning = ''

  // Use AI to analyze the message
  const prompt = `Analyze this message from a marketplace/escrow platform for content moderation:

Message: "${messageText}"

Check for:
1. Harassment, bullying, or inappropriate language
2. Threats or intimidation
3. Spam or promotional content
4. Phishing attempts or requests for sensitive information
5. Requests to move transactions off-platform (mentioning external payment, phone numbers, email, etc.)
6. Suspicious patterns (excessive urgency, pressure tactics)

Respond with JSON:
{
  "safe": boolean,
  "flags": {
    "harassment": boolean,
    "threats": boolean,
    "spam": boolean,
    "phishing": boolean,
    "offPlatformRequest": boolean,
    "suspiciousPattern": boolean
  },
  "severity": "low|medium|high|critical",
  "action": "allow|flag|block|alert",
  "reasoning": "brief explanation",
  "sentiment": {
    "overall": "positive|neutral|negative",
    "intensity": 0-100
  },
  "extractedEntities": {
    "phoneNumbers": ["phone numbers found"],
    "emailAddresses": ["emails found"],
    "urls": ["urls found"],
    "paymentMethods": ["payment methods mentioned"]
  }
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a content moderation system for a secure escrow platform. Detect harmful, spam, or policy-violating content. Be thorough but not overly sensitive.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}')
    
    // Extract flags
    if (analysis.flags) {
      flags.harassment = analysis.flags.harassment || false
      flags.threats = analysis.flags.threats || false
      flags.spam = analysis.flags.spam || false
      flags.phishing = analysis.flags.phishing || false
      flags.offPlatformRequest = analysis.flags.offPlatformRequest || false
      flags.suspiciousPattern = analysis.flags.suspiciousPattern || false
    }

    severity = analysis.severity || 'low'
    action = analysis.action || 'allow'
    reasoning = analysis.reasoning || ''

    // Determine severity based on flags
    if (flags.threats) {
      severity = 'critical'
      action = 'block'
    } else if (flags.harassment || flags.phishing) {
      severity = 'high'
      action = action === 'allow' ? 'flag' : action
    } else if (flags.offPlatformRequest || flags.spam) {
      severity = 'medium'
      action = 'flag'
    }

    // Check for pattern of suspicious messages from this sender
    if (context?.senderId) {
      const patternAnalysis = await analyzeCommunicationPattern(context.senderId, context.conversationId)
      if (patternAnalysis.isSuspicious) {
        flags.suspiciousPattern = true
        if (severity === 'low') severity = 'medium'
        if (action === 'allow') action = 'flag'
        reasoning += ` Suspicious communication pattern detected (${patternAnalysis.reason}).`
      }
    }

    return {
      safe: analysis.safe !== false && severity === 'low',
      flags,
      severity,
      action,
      reasoning,
      sentiment: analysis.sentiment || {
        overall: 'neutral',
        intensity: 50,
      },
      extractedEntities: analysis.extractedEntities || {
        phoneNumbers: [],
        emailAddresses: [],
        urls: [],
        paymentMethods: [],
      },
    }
  } catch (error) {
    console.error('Message moderation failed:', error)
    
    // Fallback: basic keyword-based detection
    const lowerText = messageText.toLowerCase()
    const hasOffPlatformKeywords = [
      'venmo', 'paypal', 'zelle', 'cashapp', 'etransfer',
      'call me at', 'text me', 'email me', 'whatsapp',
    ].some(keyword => lowerText.includes(keyword))

    if (hasOffPlatformKeywords) {
      flags.offPlatformRequest = true
      severity = 'medium'
      action = 'flag'
      reasoning = 'Possible off-platform transaction request detected'
    }

    return {
      safe: !hasOffPlatformKeywords,
      flags,
      severity,
      action,
      reasoning,
      sentiment: {
        overall: 'neutral',
        intensity: 50,
      },
      extractedEntities: {
        phoneNumbers: [],
        emailAddresses: [],
        urls: [],
        paymentMethods: [],
      },
    }
  }
}

/**
 * Analyze communication pattern for a user
 */
async function analyzeCommunicationPattern(
  senderId: string,
  conversationId?: string
): Promise<{
  isSuspicious: boolean
  reason: string
}> {
  const supabase = createServerClient()

  // Get recent messages from this sender
  const { data: messages } = await supabase
    .from('messages')
    .select('body, created_at')
    .eq('sender_id', senderId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!messages || messages.length === 0) {
    return { isSuspicious: false, reason: '' }
  }

  // Check for patterns
  const offPlatformCount = messages.filter(m => {
    const lower = m.body.toLowerCase()
    return ['venmo', 'paypal', 'zelle', 'cashapp', 'call me', 'text me'].some(k => lower.includes(k))
  }).length

  if (offPlatformCount >= 2) {
    return {
      isSuspicious: true,
      reason: `Multiple off-platform requests (${offPlatformCount} of last ${messages.length} messages)`,
    }
  }

  // Check message frequency (spam detection)
  if (messages.length >= 5) {
    const timeSpan = new Date(messages[0].created_at).getTime() - new Date(messages[messages.length - 1].created_at).getTime()
    const hours = timeSpan / (1000 * 60 * 60)
    if (hours < 1 && messages.length >= 5) {
      return {
        isSuspicious: true,
        reason: 'Very high message frequency (possible spam)',
      }
    }
  }

  return { isSuspicious: false, reason: '' }
}

/**
 * Moderate a message and take action if needed
 */
export async function moderateAndAction(
  messageText: string,
  context: {
    conversationId: string
    senderId: string
    receiverId?: string
    riftId?: string
  }
): Promise<{
  allowed: boolean
  moderationResult: ModerationResult
  actionTaken?: string
}> {
  const moderation = await moderateMessage(messageText, context)

  if (moderation.action === 'block') {
    // Log the blocked message but don't save it
    await logModerationEvent({
      messageText,
      context,
      moderation,
      action: 'blocked',
    })

    return {
      allowed: false,
      moderationResult: moderation,
      actionTaken: 'Message blocked and not delivered',
    }
  }

  if (moderation.action === 'flag' || moderation.action === 'alert') {
    // Save message but flag it for admin review
    await logModerationEvent({
      messageText,
      context,
      moderation,
      action: 'flagged',
    })

    // Optionally notify admins for high severity
    if (moderation.severity === 'critical' || moderation.severity === 'high') {
      // In production, send notification to admin queue
      console.warn(`[MODERATION ALERT] ${moderation.severity} severity: ${moderation.reasoning}`)
    }
  }

  return {
    allowed: true,
    moderationResult: moderation,
    actionTaken: moderation.action !== 'allow' ? `Message ${moderation.action}ed` : undefined,
  }
}

/**
 * Log moderation events for audit
 */
async function logModerationEvent(data: {
  messageText: string
  context: any
  moderation: ModerationResult
  action: string
}): Promise<void> {
  // In production, store this in a moderation_logs table
  // For now, log to console
  console.log('[MODERATION]', {
    action: data.action,
    severity: data.moderation.severity,
    flags: data.moderation.flags,
    reasoning: data.moderation.reasoning,
    context: data.context,
  })
}

