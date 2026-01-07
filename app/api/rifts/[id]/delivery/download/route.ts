import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * GET /api/rifts/[id]/delivery/download
 * Buyer downloads delivery file - generates signed URL
 */
export async function GET(
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
    const { searchParams } = new URL(request.url)
    const viewerSessionId = searchParams.get('viewerSessionId')

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

    // Get delivery
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

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('digital-deliveries')
      .createSignedUrl(delivery.storage_path, 3600) // 1 hour

    if (urlError || !signedUrlData) {
      console.error('Signed URL generation error:', urlError)
      return NextResponse.json(
        { error: 'Failed to generate download URL', details: urlError?.message },
        { status: 500 }
      )
    }

    // If viewer session ID provided, mark as downloaded
    if (viewerSessionId) {
      const { error: updateError } = await supabase
        .from('delivery_views')
        .update({
          downloaded: true,
          last_event_at: new Date().toISOString(),
        })
        .eq('viewer_session_id', viewerSessionId)
        .eq('buyer_id', userId)

      if (!updateError) {
        // Log download event
        const requestMeta = extractRequestMetadata(request)
        await logEvent(
          riftId,
          RiftEventActorType.BUYER,
          userId,
          'BUYER_DOWNLOADED_DELIVERY',
          {
            viewerSessionId,
            fileName: delivery.file_name,
          },
          requestMeta
        )
      }
    } else {
      // Log download event even without session ID
      const requestMeta = extractRequestMetadata(request)
      await logEvent(
        riftId,
        RiftEventActorType.BUYER,
        userId,
        'BUYER_DOWNLOADED_DELIVERY',
        {
          fileName: delivery.file_name,
        },
        requestMeta
      )
    }

    return NextResponse.json({
      success: true,
      downloadUrl: signedUrlData.signedUrl,
      fileName: delivery.file_name,
      expiresIn: 3600, // seconds
    })
  } catch (error: any) {
    console.error('Download delivery error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

