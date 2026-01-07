import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * POST /api/rifts/[id]/delivery/viewer
 * Buyer opens delivery viewer - creates a viewer session
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
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    if (rift.buyerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (rift.itemType !== 'DIGITAL_GOODS') {
      return NextResponse.json(
        { error: 'This endpoint is only for digital goods' },
        { status: 400 }
      )
    }

    // Check if delivery exists
    const supabase = createServerClient()
    const { data: delivery, error: deliveryError } = await supabase
      .from('digital_deliveries')
      .select('*')
      .eq('rift_id', riftId)
      .single()

    if (deliveryError || !delivery) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      )
    }

    // Create viewer session
    const viewerSessionId = randomUUID()
    const { data: view, error: viewError } = await supabase
      .from('delivery_views')
      .insert({
        rift_id: riftId,
        viewer_session_id: viewerSessionId,
        buyer_id: userId,
        started_at: new Date().toISOString(),
        last_event_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (viewError) {
      console.error('Viewer session creation error:', viewError)
      return NextResponse.json(
        { error: 'Failed to create viewer session', details: viewError.message },
        { status: 500 }
      )
    }

    // Log event
    const requestMeta = extractRequestMetadata(request)
    await logEvent(
      riftId,
      RiftEventActorType.BUYER,
      userId,
      'BUYER_VIEWED_DELIVERY',
      {
        viewerSessionId,
      },
      requestMeta
    )

    return NextResponse.json({
      success: true,
      viewerSessionId,
      delivery: {
        id: delivery.id,
        fileName: delivery.file_name,
        mimeType: delivery.mime_type,
        sizeBytes: delivery.size_bytes,
      },
    })
  } catch (error: any) {
    console.error('Create viewer session error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/rifts/[id]/delivery/viewer
 * Buyer pings viewer session to update engagement time
 */
export async function PATCH(
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
    const { viewerSessionId, secondsIncrement } = body

    if (!viewerSessionId || typeof secondsIncrement !== 'number') {
      return NextResponse.json(
        { error: 'viewerSessionId and secondsIncrement are required' },
        { status: 400 }
      )
    }

    // Verify buyer owns this session
    const supabase = createServerClient()
    const { data: view, error: viewError } = await supabase
      .from('delivery_views')
      .select('*')
      .eq('viewer_session_id', viewerSessionId)
      .eq('rift_id', riftId)
      .eq('buyer_id', userId)
      .single()

    if (viewError || !view) {
      return NextResponse.json(
        { error: 'Viewer session not found or unauthorized' },
        { status: 404 }
      )
    }

    // Update seconds viewed (server-side only to prevent client manipulation)
    const newSecondsViewed = (view.seconds_viewed || 0) + secondsIncrement
    const { error: updateError } = await supabase
      .from('delivery_views')
      .update({
        seconds_viewed: newSecondsViewed,
        last_event_at: new Date().toISOString(),
      })
      .eq('viewer_session_id', viewerSessionId)

    if (updateError) {
      console.error('Update viewer session error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update viewer session', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      secondsViewed: newSecondsViewed,
    })
  } catch (error: any) {
    console.error('Update viewer session error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

