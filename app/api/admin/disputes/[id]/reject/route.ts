import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/admin/disputes/[id]/reject
 * Admin rejects dispute as invalid
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
    const { note } = body

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

    // Get rift to determine previous status
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        id: true,
        status: true,
        itemType: true,
      },
    })

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    // Update dispute status
    const { error: updateError } = await supabase
      .from('disputes')
      .update({ status: 'rejected' })
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
      action_type: 'rejected',
      note: note || 'Dispute rejected as invalid',
    })

    // Restore rift to eligible state
    let newRiftStatus = 'DELIVERED_PENDING_RELEASE'
    if (rift.itemType === 'DIGITAL' || rift.itemType === 'SERVICES' || rift.itemType === 'TICKETS') {
      newRiftStatus = 'DELIVERED_PENDING_RELEASE'
    }

    await prisma.riftTransaction.update({
      where: { id: dispute.rift_id },
      data: {
        status: newRiftStatus,
        releaseEligibleAt: new Date(),
      },
    })

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      dispute.rift_id,
      RiftEventActorType.ADMIN,
      auth.userId,
      'DISPUTE_REJECTED',
      {
        disputeId,
        note: note || '',
      },
      requestMeta
    )

    // Post system message
    await postSystemMessage(
      dispute.rift_id,
      'Dispute was rejected. Funds are now eligible for release.'
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Reject dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

