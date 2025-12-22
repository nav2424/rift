import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { postSystemMessage } from '@/lib/rift-messaging'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/delivery/upload
 * Seller uploads a digital delivery file
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

    // Verify category is digital goods
    if (rift.itemType !== 'DIGITAL') {
      return NextResponse.json(
        { error: 'This endpoint is only for digital goods' },
        { status: 400 }
      )
    }

    // Verify status allows upload
    if (!['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW'].includes(rift.status)) {
      return NextResponse.json(
        { error: 'Rift is not in a state that allows delivery upload' },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file size (e.g., max 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed (100MB)' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const supabase = createServerClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${riftId}/${Date.now()}.${fileExt}`
    const storagePath = `digital-deliveries/${fileName}`

    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('digital-deliveries')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite existing files
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    // Create digital_deliveries record
    const { data: delivery, error: deliveryError } = await supabase
      .from('digital_deliveries')
      .insert({
        rift_id: riftId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: userId,
        viewer_enabled: true,
      })
      .select()
      .single()

    if (deliveryError) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from('digital-deliveries').remove([storagePath])
      console.error('Delivery record creation error:', deliveryError)
      return NextResponse.json(
        { error: 'Failed to create delivery record', details: deliveryError.message },
        { status: 500 }
      )
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
      'SELLER_UPLOADED_DIGITAL_DELIVERY',
      {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
      },
      requestMeta
    )

    // Post system message
    await postSystemMessage(
      riftId,
      'Digital delivery uploaded. Buyer can access it in Rift.'
    )

    return NextResponse.json({
      success: true,
      delivery: {
        id: delivery.id,
        fileName: delivery.file_name,
        mimeType: delivery.mime_type,
        sizeBytes: delivery.size_bytes,
        uploadedAt: delivery.uploaded_at,
      },
    })
  } catch (error: any) {
    console.error('Upload delivery error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

