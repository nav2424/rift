import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.userId

    // Get Supabase client
    let supabase
    try {
      supabase = createServerClient()
    } catch (supabaseError: any) {
      console.error('Supabase configuration error:', supabaseError)
      // Check if it's a configuration error
      if (supabaseError?.message?.includes('Supabase configuration missing')) {
        return NextResponse.json(
          {
            error: 'Internal server error',
            details: supabaseError.message + '\n\nPlease ensure your Next.js dev server has been restarted after adding environment variables.',
          },
          { status: 500 }
        )
      }
      throw supabaseError
    }

    // Get all conversations where user is a participant
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, role')
      .eq('user_id', userId)

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const conversationIds = participants.map((p) => p.conversation_id)

    // Fetch conversations
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    // For each conversation, get details
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv) => {
        try {
          // Get all participants for this conversation
          const { data: convParticipants, error: participantsErr } = await supabase
            .from('conversation_participants')
            .select('user_id, role')
            .eq('conversation_id', conv.id)

          if (participantsErr) {
            console.error('Error fetching participants for conversation', conv.id, participantsErr)
          }

          // Get other participants (excluding current user)
          const otherParticipants = (convParticipants || []).filter(
            (p) => p.user_id !== userId
          )

          // Get participant info from Prisma
          const participantUserIds = otherParticipants.map((p) => p.user_id)
          const participantUsers = await prisma.user.findMany({
            where: { id: { in: participantUserIds } },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })

          // Get latest message
          const { data: messages, error: messageError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (messageError && messageError.code !== 'PGRST116') {
            console.error('Error fetching message for conversation', conv.id, messageError)
          }

          // Calculate unread count: messages where read_at is null, sender is not current user, and not system messages
          // System messages (sender_id is null) should not count as unread
          // Get all unread messages and filter system messages in code (more reliable than complex Supabase query)
          const { data: unreadMessages, error: unreadError } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('conversation_id', conv.id)
            .is('read_at', null)
            .neq('sender_id', userId)
          
          // Filter out system messages (sender_id is null) and count
          const unreadCount = unreadError 
            ? 0 
            : (unreadMessages || []).filter(msg => msg.sender_id !== null).length

          // unreadCount is now calculated above with system message filtering

          // Get transaction info from the first participant's role or find via transaction lookup
          // Since we don't store transaction_id directly, we'll need to find it via participants
          // For now, we'll use a placeholder - you may want to add a transaction_id field to conversations
          // or find it another way based on your business logic
          const transactionId = null // TODO: Add transaction_id to conversations table or find via other means
          let transaction = null

          // Try to find transaction by looking at participant roles
          // If there's a buyer and seller, we can try to find the transaction
          const buyerParticipant = convParticipants?.find((p) => p.role === 'buyer')
          const sellerParticipant = convParticipants?.find((p) => p.role === 'seller')

          if (buyerParticipant && sellerParticipant) {
            // Try to find transaction by buyer and seller
            transaction = await prisma.riftTransaction.findFirst({
              where: {
                buyerId: buyerParticipant.user_id,
                sellerId: sellerParticipant.user_id,
              },
              select: {
                id: true,
                itemTitle: true,
                status: true,
                buyer: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                seller: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            })
          }

          // Determine the other participant
          const otherParticipant = participantUsers.find(
            (u) => u.id !== userId
          ) || participantUsers[0] || null

          return {
            id: conv.id,
            transactionId: transaction?.id || null,
            transactionTitle: transaction?.itemTitle || 'Unknown Transaction',
            transactionStatus: transaction?.status || null,
            otherParticipant: otherParticipant
              ? {
                  id: otherParticipant.id,
                  name: otherParticipant.name,
                  email: otherParticipant.email,
                }
              : null,
            lastMessage: messages
              ? {
                  id: messages.id,
                  body: messages.body,
                  senderId: messages.sender_id,
                  createdAt: messages.created_at,
                }
              : null,
            updatedAt: conv.last_message_at || conv.created_at,
            unreadCount: unreadCount,
          }
        } catch (error: any) {
          console.error('Error processing conversation', conv.id, error)
          return {
            id: conv.id,
            transactionId: null,
            transactionTitle: 'Error loading transaction',
            transactionStatus: null,
            otherParticipant: null,
            lastMessage: null,
            updatedAt: conv.last_message_at || conv.created_at,
            unreadCount: 0, // Error case - default to 0
          }
        }
      })
    )

    return NextResponse.json({ conversations: conversationsWithDetails })
  } catch (error: any) {
    console.error('Get conversations error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
