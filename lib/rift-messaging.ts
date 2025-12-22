/**
 * Helper functions for posting system messages to Rift conversations
 */

import { createServerClient } from './supabase'
import { prisma } from './prisma'

/**
 * Post a system message to a Rift's conversation
 * @param riftId - The Rift transaction ID
 * @param message - The system message text
 */
export async function postSystemMessage(riftId: string, message: string): Promise<void> {
  try {
    // Get the rift to find buyer and seller
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift) {
      console.error(`[SystemMessage] Rift not found: ${riftId}`)
      return
    }

    const supabase = createServerClient()

    // Get or create conversation for this transaction
    // We'll reuse the logic from the API route
    const { data: buyerParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', rift.buyerId)
      .eq('role', 'buyer')

    let conversationId: string | null = null

    if (buyerParticipants && buyerParticipants.length > 0) {
      const conversationIds = [...new Set(buyerParticipants.map(p => p.conversation_id))]
      
      for (const convId of conversationIds) {
        const { data: sellerCheck } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('conversation_id', convId)
          .eq('user_id', rift.sellerId)
          .eq('role', 'seller')
          .maybeSingle()

        if (sellerCheck) {
          conversationId = convId
          break
        }
      }
    }

    // If no conversation exists, create one
    if (!conversationId) {
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single()

      if (createError || !newConversation) {
        console.error(`[SystemMessage] Failed to create conversation:`, createError)
        return
      }

      conversationId = newConversation.id

      // Add participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: conversationId, user_id: rift.buyerId, role: 'buyer' },
        { conversation_id: conversationId, user_id: rift.sellerId, role: 'seller' },
      ])
    }

    // Post system message (sender_id is null for system messages)
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: null, // System message
        body: message,
      })

    if (messageError) {
      console.error(`[SystemMessage] Failed to post message:`, messageError)
    }
  } catch (error: any) {
    // Never throw - system messages should not break the main flow
    console.error(`[SystemMessage] Error posting system message for rift ${riftId}:`, error.message)
  }
}

