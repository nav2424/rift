import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { analyzeSupportRequest, generateSupportTicket } from '@/lib/ai/support-escalation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// System prompt for Rift chatbot
const SYSTEM_PROMPT = `You are a helpful AI assistant for Rift, a secure transaction platform for marketplace transactions. 

Rift helps buyers and sellers complete transactions safely by:
- Holding funds securely until delivery is confirmed
- Providing buyer protection and dispute resolution
- Supporting different item types: Physical goods, Digital products, Tickets, and Services
- Using a wallet system where sellers receive funds after proof submission and buyer confirmation

Key information about Rift:
- Buyer fee: 3% of transaction amount
- Seller fee: 5% of transaction amount
- Funds are held securely until buyer confirms receipt
- Sellers can submit proof (files, tracking numbers, license keys, etc.) to the vault
- Buyers can view proof and confirm delivery
- Disputes can be raised if there are issues
- Admin team reviews suspicious transactions

Your role:
- Answer questions about how Rift works
- Help users understand the transaction flow
- Explain fees and pricing
- Guide users on how to use features
- Provide general support information
- Be friendly, concise, and helpful
- If you don't know something specific, direct users to contact support at support@rift.com

Keep responses concise (2-3 sentences when possible) and focus on being helpful.`

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory, userId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // AI Support Escalation Analysis
    const escalationAnalysis = await analyzeSupportRequest(
      message,
      conversationHistory?.map((m: any) => ({
        role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
        content: m.content || m.message || m.text,
      }))
    )

    // If escalation is needed, return escalation info
    if (escalationAnalysis.shouldEscalate && escalationAnalysis.requiresHuman) {
      const ticket = userId 
        ? await generateSupportTicket(userId, message, escalationAnalysis.category)
        : null

      return NextResponse.json({
        response: `I understand you need help with ${escalationAnalysis.category}. This requires human assistance. ${ticket ? 'A support ticket has been created for you.' : 'Please contact support@rift.com for immediate assistance.'}`,
        escalate: true,
        urgency: escalationAnalysis.urgency,
        category: escalationAnalysis.category,
        ticket: ticket || null,
      })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          response:
            "I'm sorry, the AI assistant is not configured. Please contact support@rift.com for help.",
        },
        { status: 200 }
      )
    }

    // Build messages array for OpenAI
    const messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }> = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
    ]

    // Add conversation history (last 10 messages to keep context manageable)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10)
      messages.push(...recentHistory)
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message,
    })

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency, can upgrade to gpt-4o if needed
      messages: messages as any,
      max_tokens: 500,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 
      "I'm sorry, I couldn't generate a response. Please try again."

    return NextResponse.json({ response })
  } catch (error: any) {
    console.error('Chatbot API error:', error)
    
    return NextResponse.json(
      {
        response:
          "I'm sorry, I encountered an error. Please try again or contact support@rift.com for assistance.",
      },
      { status: 200 } // Return 200 so UI doesn't show error state
    )
  }
}

