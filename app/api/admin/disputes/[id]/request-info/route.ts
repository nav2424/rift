import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { sendDisputeInfoRequestedEmail } from '@/lib/email'

/**
 * POST /api/admin/disputes/[id]/request-info
 * Admin requests more information from buyer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId } = await params
    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('rift_id, status')
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    // Update dispute status
    const { error: updateError } = await supabase
      .from('disputes')
      .update({ status: 'needs_info' })
      .eq('id', disputeId)

    if (updateError) {
      console.error('Update dispute error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update dispute', details: updateError.message },
        { status: 500 }
      )
    }

    // Create dispute action
    await supabase.from('dispute_actions').insert({
      dispute_id: disputeId,
      actor_id: auth.userId,
      actor_role: 'admin',
      action_type: 'requested_info',
      note: message,
    })

    // Send email notification (not in chat)
    try {
      const rift = await prisma.riftTransaction.findUnique({
        where: { id: dispute.rift_id },
        include: {
          buyer: true,
          seller: true,
        },
      })
      
      if (rift) {
        // Get the user who opened the dispute
        const { data: disputeData } = await supabase
          .from('disputes')
          .select('opened_by')
          .eq('id', disputeId)
          .single()
        
        if (disputeData) {
          const userEmail = disputeData.opened_by === rift.buyerId 
            ? rift.buyer.email 
            : rift.seller.email
          
          await sendDisputeInfoRequestedEmail(
            userEmail,
            dispute.rift_id,
            rift.itemTitle || 'Rift Transaction',
            message
          )
        }
      }
    } catch (emailError) {
      console.error('Error sending dispute info request email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Request info error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

