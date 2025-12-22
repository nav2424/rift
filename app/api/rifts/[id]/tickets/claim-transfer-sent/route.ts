import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/tickets/claim-transfer-sent
 * Seller claims ticket transfer has been sent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: riftId } = await params
    const userId = auth.userId
    const body = await request.json()
    const { provider } = body

    // Get rift and verify seller
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        sellerId: true,
        itemType: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify category is tickets
    if (rift.itemType !== 'TICKETS') {
      return NextResponse.json(
        { error: 'This endpoint is only for tickets' },
        { status: 400 }
      )
    }

    // Verify status allows claiming transfer sent
    if (!['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
      return NextResponse.json(
        { error: 'Rift is not in a state that allows claiming transfer sent' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['ticketmaster', 'axs', 'seatgeek', 'stubhub', 'other']
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Provider must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Get or create ticket transfer record
    const supabase = createServerClient()
    const { data: existingTransfer } = await supabase
      .from('ticket_transfers')
      .select('*')
      .eq('rift_id', riftId)
      .single()

    if (existingTransfer) {
      // Update existing transfer
      const { error: updateError } = await supabase
        .from('ticket_transfers')
        .update({
          seller_claimed_sent_at: new Date().toISOString(),
          status: 'seller_sent',
          ...(provider && { provider }),
        })
        .eq('rift_id', riftId)

      if (updateError) {
        console.error('Update ticket transfer error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update ticket transfer', details: updateError.message },
          { status: 500 }
        )
      }
    } else {
      // Create new transfer record (transfer_to_email should already be set from required details)
      // For now, we'll require it to be passed or retrieved from required details
      const { error: insertError } = await supabase
        .from('ticket_transfers')
        .insert({
          rift_id: riftId,
          provider: provider || 'other',
          transfer_to_email: '', // Should be set from required details - TODO: fetch from required details
          seller_claimed_sent_at: new Date().toISOString(),
          status: 'seller_sent',
        })

      if (insertError) {
        console.error('Create ticket transfer error:', insertError)
        return NextResponse.json(
          { error: 'Failed to create ticket transfer', details: insertError.message },
          { status: 500 }
        )
      }
    }

    // Update rift status to delivered
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: { status: 'DELIVERED_PENDING_RELEASE' },
    })

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      riftId,
      RiftEventActorType.SELLER,
      userId,
      'SELLER_CLAIMED_TRANSFER_SENT',
      {
        provider: provider || 'other',
      },
      requestMeta
    )

    // Post system message
    await postSystemMessage(
      riftId,
      'Seller marked ticket transfer as sent.'
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Claim transfer sent error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

