import { requireAuth } from '@/lib/auth-helpers'
import { createServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ConversationPanel from '@/components/ConversationPanel'
import GlassCard from '@/components/ui/GlassCard'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ConversationDetail({ 
  params 
}: { 
  params: Promise<{ conversationId: string }> 
}) {
  const session = await requireAuth()
  const userId = session.user.id
  const { conversationId } = await params

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
    transaction = await prisma.escrowTransaction.findFirst({
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

  const otherParticipant = participantUsers[0] || null
  const displayName = otherParticipant?.name || otherParticipant?.email || 'Unknown User'

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none" 
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} 
      />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/messages"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white font-light text-sm mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Messages
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-light text-white mb-2 tracking-tight">
                {displayName}
              </h1>
              {transaction && (
                <Link 
                  href={`/escrows/${transaction.id}`}
                  className="text-white/60 hover:text-white/80 font-light text-sm transition-colors"
                >
                  View Transaction: {transaction.itemTitle}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Panel */}
        <ConversationPanel conversationId={conversationId} />
      </div>
    </div>
  )
}
