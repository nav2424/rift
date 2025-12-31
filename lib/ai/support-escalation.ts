/**
 * AI-Powered Customer Support Escalation
 * 
 * Features:
 * - Detect when chatbot should escalate to human
 * - Pre-populate support tickets with context
 * - Auto-categorize support requests
 * - Suggest solutions based on similar past tickets
 */

import OpenAI from 'openai'
import { prisma } from '../prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface SupportAnalysis {
  shouldEscalate: boolean
  urgency: 'low' | 'medium' | 'high' | 'critical'
  category: string
  subcategory?: string
  suggestedSolution?: string
  confidence: number
  requiresHuman: boolean
  contextSummary: string
}

/**
 * Analyze a support request to determine if escalation is needed
 */
export async function analyzeSupportRequest(
  userMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<SupportAnalysis> {
  const prompt = `Analyze this customer support request and determine if it should be escalated to a human agent:

User Message: "${userMessage}"

${conversationHistory ? `Conversation History:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}` : ''}

Determine if this requires human escalation. Consider:
- Technical issues that need investigation
- Account access problems
- Payment/dispute issues
- Complex questions the bot cannot answer
- User frustration or confusion
- Security concerns

Respond with JSON:
{
  "shouldEscalate": boolean,
  "urgency": "low|medium|high|critical",
  "category": "category (e.g., payment, account, technical, dispute, general)",
  "subcategory": "more specific subcategory if applicable",
  "suggestedSolution": "brief suggested solution if bot can help",
  "confidence": 0-100,
  "requiresHuman": boolean,
  "contextSummary": "brief summary of the issue"
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a customer support triage system. Determine when requests need human escalation vs when the chatbot can help.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}') as SupportAnalysis

    return analysis
  } catch (error) {
    console.error('Support escalation analysis failed:', error)
    
    // Conservative fallback - escalate if unclear
    return {
      shouldEscalate: true,
      urgency: 'medium',
      category: 'unknown',
      confidence: 0,
      requiresHuman: true,
      contextSummary: userMessage.substring(0, 200),
    }
  }
}

/**
 * Categorize a support request
 */
export async function categorizeSupportRequest(message: string): Promise<{
  category: string
  subcategory?: string
  keywords: string[]
}> {
  const prompt = `Categorize this support request:

"${message}"

Respond with JSON:
{
  "category": "payment|account|technical|dispute|refund|general",
  "subcategory": "more specific category if applicable",
  "keywords": ["keyword1", "keyword2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Categorize customer support requests accurately.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    return JSON.parse(completion.choices[0].message.content || '{}')
  } catch (error) {
    console.error('Support categorization failed:', error)
    return {
      category: 'general',
      keywords: [],
    }
  }
}

/**
 * Generate a pre-populated support ticket with context
 */
export async function generateSupportTicket(
  userId: string,
  userMessage: string,
  category: string
): Promise<{
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  context: Record<string, any>
}> {
  // Get user context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      createdAt: true,
    },
  })

  // Get recent transactions
  const recentRifts = await prisma.riftTransaction.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    select: {
      id: true,
      itemTitle: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const context = {
    user: {
      email: user?.email,
      name: user?.name,
      accountAge: user ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
    },
    recentTransactions: recentRifts.length,
    recentEscrowStatuses: recentRifts.map(r => r.status),
  }

  // Generate ticket
  const prompt = `Create a support ticket based on this request:

User Message: "${userMessage}"
Category: ${category}

User Context:
${JSON.stringify(context, null, 2)}

Generate a professional support ticket in JSON:
{
  "title": "concise ticket title",
  "description": "formatted ticket description with user message and context",
  "priority": "low|medium|high|critical",
  "context": ${JSON.stringify(context)}
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Create well-structured support tickets with appropriate priority levels.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const ticket = JSON.parse(completion.choices[0].message.content || '{}')
    ticket.context = context

    return ticket
  } catch (error) {
    console.error('Support ticket generation failed:', error)
    
    return {
      title: `Support Request: ${category}`,
      description: userMessage,
      priority: 'medium',
      context,
    }
  }
}

