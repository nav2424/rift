import { requireAuth } from '@/lib/auth-helpers'
import { createServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ConversationPanel from '@/components/ConversationPanel'
import GlassCard from '@/components/ui/GlassCard'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ConversationDetail({ 
  params,
  searchParams
}: { 
  params: Promise<{ conversationId: string }>
  searchParams?: Promise<{ riftId?: string }>
}) {
  const session = await requireAuth()
  const userId = session.user.id
  const { conversationId } = await params
  const search = await searchParams
  const riftIdFromQuery = search?.riftId

  let supabase
  try {
    supabase = createServerClient()
  } catch (error: any) {
    console.error('Supabase configuration error:', error)
    notFound()
  }

  // Check if user is a participant
  const { data: participant, error: participantError } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (participantError || !participant) {
    notFound()
  }

  // Get conversation details
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (convError || !conversation) {
    notFound()
  }

  // Get all participants
  const { data: participants, error: participantsError } = await supabase
    .from('conversation_participants')
    .select('user_id, role')
    .eq('conversation_id', conversationId)

  if (participantsError) {
    console.error('Error fetching participants:', participantsError)
  }

  // Get other participants (excluding current user)
  const otherParticipantIds = (participants || [])
    .filter((p) => p.user_id !== userId)
    .map((p) => p.user_id)

  // Get participant user info
  const participantUsers = await prisma.user.findMany({
    where: { id: { in: otherParticipantIds } },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  // Try to find associated transaction if there's a buyer and seller
  const buyerParticipant = participants?.find((p) => p.role === 'buyer')
  const sellerParticipant = participants?.find((p) => p.role === 'seller')
  let transaction = null

  if (buyerParticipant && sellerParticipant) {
    // If riftId is passed in query params (from navigation from rift page), use that specific transaction
    if (riftIdFromQuery) {
      transaction = await prisma.riftTransaction.findFirst({
        where: {
          id: riftIdFromQuery,
          buyerId: buyerParticipant.user_id,
          sellerId: sellerParticipant.user_id,
        },
        select: {
          id: true,
          itemTitle: true,
          status: true,
        },
      })
    }
    
    // If no transaction found (or no riftId in query), fall back to finding most recent transaction
    if (!transaction) {
      transaction = await prisma.riftTransaction.findFirst({
        where: {
          buyerId: buyerParticipant.user_id,
          sellerId: sellerParticipant.user_id,
        },
        select: {
          id: true,
          itemTitle: true,
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    }
  }

  const otherParticipant = participantUsers[0] || null
  const displayName = otherParticipant?.name || otherParticipant?.email || 'Unknown User'

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* Subtle grid background */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none" 
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} 
      />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-gray-50 rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-light text-[#1d1d1f] mb-2 tracking-tight truncate">
                  {displayName}
                </h1>
                {transaction && (
                  <Link 
                    href={`/rifts/${transaction.id}`}
                    className="text-[#86868b] hover:text-gray-700 font-light text-sm transition-colors"
                  >
                    View Transaction: {transaction.itemTitle}
                  </Link>
                )}
              </div>
            </div>
            {transaction ? (
              <Link 
                href={`/rifts/${transaction.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-[#1d1d1f] bg-gray-100 hover:bg-white/20 border border-gray-300 hover:border-gray-300 rounded-lg font-light text-sm transition-all duration-200 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Rift
              </Link>
            ) : (
              <Link 
                href="/messages"
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-[#1d1d1f] bg-gray-100 hover:bg-white/20 border border-gray-300 hover:border-gray-300 rounded-lg font-light text-sm transition-all duration-200 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Messages
              </Link>
            )}
          </div>
        </div>

        {/* Conversation Panel */}
        <ConversationPanel conversationId={conversationId} />
      </div>
    </div>
  )
}

