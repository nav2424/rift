import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { releaseFunds } from '@/lib/release-engine'
import { transitionRiftState } from '@/lib/rift-state'

/**
 * POST /api/rifts/[id]/tickets/confirm-receipt
 * Buyer confirms ownership transfer receipt
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

    // Get rift and verify buyer
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        itemType: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.buyerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify category is ownership transfer
    if (rift.itemType !== 'OWNERSHIP_TRANSFER') {
      return NextResponse.json(
        { error: 'This endpoint is only for ownership transfers' },
        { status: 400 }
      )
    }

    // Verify seller has claimed transfer sent
    const supabase = createServerClient()
    const { data: transfer, error: transferError } = await supabase
      .from('ticket_transfers')
      .select('*')
      .eq('rift_id', riftId)
      .single()

    if (transferError || !transfer) {
      return NextResponse.json(
        { error: 'Ticket transfer not found. Seller must claim transfer sent first.' },
        { status: 400 }
      )
    }

    if (transfer.status !== 'seller_sent') {
      return NextResponse.json(
        { error: 'Seller must claim transfer sent before buyer can confirm receipt' },
        { status: 400 }
      )
    }

    // Update transfer status
    const { error: updateError } = await supabase
      .from('ticket_transfers')
      .update({
        buyer_confirmed_received_at: new Date().toISOString(),
        status: 'buyer_confirmed',
      })
      .eq('rift_id', riftId)

    if (updateError) {
      console.error('Update ticket transfer error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update ticket transfer', details: updateError.message },
        { status: 500 }
      )
    }

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      riftId,
      RiftEventActorType.BUYER,
      userId,
      'BUYER_CONFIRMED_TICKET_RECEIPT',
      {
        provider: transfer.provider,
      },
      requestMeta
    )

    // Automatically release funds when buyer confirms receipt
    const releaseResult = await releaseFunds(riftId, requestMeta)

    if (!releaseResult.success) {
      // If release fails, still mark as eligible but log the error
      console.error('Auto-release failed after confirm receipt:', releaseResult.error)
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: {
          releaseEligibleAt: new Date(),
        },
      })
      // Return success anyway - the confirmation was recorded, release will happen via auto-release
      return NextResponse.json({ 
        success: true,
        warning: releaseResult.error || 'Funds will be released automatically',
      })
    }

    // Transition to RELEASED (handles wallet credit, payout scheduling)
    await transitionRiftState(riftId, 'RELEASED', { userId })

    // Don't post system messages - status updates are visible in the platform and sent via email

    return NextResponse.json({ 
      success: true,
      status: 'RELEASED',
      message: 'Ticket receipt confirmed and funds released to seller',
    })
  } catch (error: any) {
    console.error('Confirm ticket receipt error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

