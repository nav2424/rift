import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { sendShipmentProofEmail } from '@/lib/email'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { verifyTracking, verifyShipmentProof } from '@/lib/tracking-verification'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const userRole = getUserRole(
      auth.userId,
      rift.buyerId,
      rift.sellerId,
      auth.userRole
    )

    if (userRole !== 'SELLER') {
      return NextResponse.json({ error: 'Only seller can upload proof' }, { status: 403 })
    }

    // Check if transition to PROOF_SUBMITTED is valid
    if (!canTransition(rift.status, 'PROOF_SUBMITTED', userRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition. Rift must be in FUNDED status to submit proof.' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const trackingNumber = formData.get('trackingNumber') as string
    const shippingCarrier = formData.get('shippingCarrier') as string
    const notes = formData.get('notes') as string
    const file = formData.get('file') as File | null

    // Only physical items require shipment proof
    if (rift.itemType !== 'PHYSICAL') {
      return NextResponse.json(
        { error: 'Shipment proof is only required for physical items' },
        { status: 400 }
      )
    }

    // For physical items, require tracking number
    if (!trackingNumber || trackingNumber.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tracking number is required for physical items' },
        { status: 400 }
      )
    }

    // Verify shipment proof
    const proofVerification = await verifyShipmentProof(
      trackingNumber || '',
      shippingCarrier || null,
      rift.shippingAddress,
      null // File path will be set after upload
    )

    if (!proofVerification.isValid) {
      return NextResponse.json(
        { error: proofVerification.errors.join(', ') },
        { status: 400 }
      )
    }

    // Verify tracking number if provided
    let trackingVerified = false
    let deliveryStatus: string | null = null
    let deliveryDate: Date | null = null

    if (trackingNumber && trackingNumber.trim().length > 0) {
      const trackingVerification = await verifyTracking(trackingNumber, shippingCarrier || undefined)
      trackingVerified = trackingVerification.isValid
      deliveryStatus = trackingVerification.status || null
      deliveryDate = trackingVerification.deliveryDate || null
    }

    let filePath: string | null = null

    // Handle file upload (stored in public/uploads)
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads')
      try {
        await mkdir(uploadsDir, { recursive: true })
      } catch (error) {
        // Directory might already exist
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop()
      const uniqueName = `${randomBytes(16).toString('hex')}.${fileExtension}`
      filePath = `/uploads/${uniqueName}`

      // Write file
      await writeFile(join(uploadsDir, uniqueName), buffer)
    }

    // Calculate grace period (48 hours from now, or from delivery if already delivered)
    const gracePeriodHours = 48
    const now = new Date()
    const gracePeriodEndsAt = new Date(now.getTime() + gracePeriodHours * 60 * 60 * 1000)

    // Create shipment proof with verification status
    const shipmentProof = await prisma.shipmentProof.create({
      data: {
        riftId: id,
        trackingNumber: trackingNumber || null,
        shippingCarrier: shippingCarrier || null,
        filePath,
        notes: notes || null,
        verified: trackingVerified,
        deliveryStatus,
        deliveryDate,
      },
    })

    // Update rift with verification and grace period info
    // Set status to PROOF_SUBMITTED (new status system)
    const updateData: any = {
      status: 'PROOF_SUBMITTED',
      proofSubmittedAt: now,
      shipmentVerifiedAt: now,
      trackingVerified: trackingVerified,
    }

    // If delivery is already confirmed, set delivery verified and grace period
    if (deliveryStatus === 'DELIVERED' && deliveryDate) {
      updateData.deliveryVerifiedAt = deliveryDate
      // Grace period starts from delivery date, not upload date
      const graceEnd = new Date(deliveryDate.getTime() + gracePeriodHours * 60 * 60 * 1000)
      updateData.gracePeriodEndsAt = graceEnd
      updateData.autoReleaseScheduled = true
    } else {
      // Will be set when delivery is confirmed
      updateData.gracePeriodEndsAt = null
      updateData.autoReleaseScheduled = false
    }

    await prisma.riftTransaction.update({
      where: { id },
      data: updateData,
    })

    // Create timeline event
    const verificationMessage = trackingVerified 
      ? `Shipment proof verified. Tracking: ${trackingNumber}${deliveryStatus === 'DELIVERED' ? ' (Delivered)' : ' (In Transit)'}`
      : `Shipment proof uploaded. Tracking: ${trackingNumber} (verification pending)`

    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: trackingVerified ? 'PROOF_VERIFIED' : 'PROOF_UPLOADED',
        message: verificationMessage + (deliveryStatus === 'DELIVERED' && deliveryDate ? `. Grace period ends ${gracePeriodEndsAt.toLocaleString()}` : ''),
        createdById: auth.userId,
      },
    })

    // Send email notification
    const escrowWithBuyer = await prisma.riftTransaction.findUnique({
      where: { id },
      include: { buyer: true },
    })
    if (escrowWithBuyer) {
      await sendShipmentProofEmail(
        escrowWithBuyer.buyer.email,
        id,
        escrowWithBuyer.itemTitle
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Upload proof error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

