import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { sendItemReceivedEmail } from '@/lib/email'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

/**
 * Mark non-physical items as delivered
 * For DIGITAL, TICKETS, and SERVICES items
 * REQUIRES PROOF FILE UPLOAD - sellers must provide proof of delivery/transfer
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

    const { id } = await params
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Only for non-physical items
    if (rift.itemType === 'PHYSICAL') {
      return NextResponse.json(
        { error: 'Use upload-shipment-proof endpoint for physical items' },
        { status: 400 }
      )
    }

    const userRole = getUserRole(
      auth.userId,
      rift.buyerId,
      rift.sellerId,
      auth.userRole
    )

    if (userRole !== 'SELLER') {
      return NextResponse.json({ error: 'Only seller can mark item as delivered' }, { status: 403 })
    }

    if (rift.status !== 'AWAITING_SHIPMENT') {
      return NextResponse.json(
        { error: 'Item can only be marked as delivered when status is AWAITING_SHIPMENT' },
        { status: 400 }
      )
    }

    // Parse FormData to get proof file and notes
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const notes = formData.get('notes') as string | null

    // REQUIRE proof file upload - sellers cannot just mark as delivered without proof
    if (!file || file.size === 0) {
      const proofType = 
        rift.itemType === 'DIGITAL' ? 'proof of digital product transfer (screenshot, license key, etc.)' :
        rift.itemType === 'TICKETS' ? 'proof of ticket transfer (screenshot of transfer confirmation, email, etc.)' :
        'proof of service completion (photos, completion certificate, etc.)'
      
      return NextResponse.json(
        { 
          error: `Proof of delivery is required. Please upload ${proofType}.` 
        },
        { status: 400 }
      )
    }

    // Verify that delivery information is present
    const hasDeliveryInfo = 
      (rift.itemType === 'DIGITAL' && rift.downloadLink) ||
      (rift.itemType === 'TICKETS' && rift.transferMethod) ||
      (rift.itemType === 'SERVICES' && rift.serviceDate)

    if (!hasDeliveryInfo) {
      return NextResponse.json(
        { 
          error: `Missing delivery information. ${rift.itemType === 'DIGITAL' ? 'Download link' : rift.itemType === 'TICKETS' ? 'Transfer method' : 'Service date'} is required.` 
        },
        { status: 400 }
      )
    }

    // Handle file upload (stored in public/uploads)
    let filePath: string | null = null
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
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const uniqueName = `${randomBytes(16).toString('hex')}.${fileExtension}`
      filePath = `/uploads/${uniqueName}`

      // Write file
      await writeFile(join(uploadsDir, uniqueName), buffer)
    }

    // Create proof record (using ShipmentProof model for consistency)
    // For non-physical items, we don't need tracking number or carrier
    const proof = await prisma.shipmentProof.create({
      data: {
        escrowId: id,
        filePath,
        notes: notes || null,
        verified: false, // Proof will be reviewed by buyer/admin
        // No tracking number or carrier for non-physical items
      },
    })

    // For non-physical items: Set up auto-release timer
    // Seller marks delivered with proof → 24-hour protection window → Auto-release (unless buyer disputes)
    const now = new Date()
    const gracePeriodHours = 24 // 24-hour protection window for instant items
    const gracePeriodEndsAt = new Date(now.getTime() + gracePeriodHours * 60 * 60 * 1000)

    // Update status and set auto-release timer
    await prisma.riftTransaction.update({
      where: { id },
      data: {
        status: 'IN_TRANSIT',
        deliveryVerifiedAt: now, // Mark as delivered when seller confirms with proof
        gracePeriodEndsAt: gracePeriodEndsAt,
        autoReleaseScheduled: true, // Schedule auto-release after 24 hours
      },
    })

    // Create timeline event
    const itemTypeName = rift.itemType.toLowerCase()
    const deliveryMessage = 
      rift.itemType === 'DIGITAL' 
        ? `Digital product delivered with proof. Funds will auto-release on ${gracePeriodEndsAt.toLocaleString()} unless buyer raises a dispute.` 
        : rift.itemType === 'TICKETS' 
        ? `Tickets transferred with proof. Funds will auto-release on ${gracePeriodEndsAt.toLocaleString()} unless buyer raises a dispute.` 
        : `Service completed with proof. Funds will auto-release on ${gracePeriodEndsAt.toLocaleString()} unless buyer raises a dispute.`

    await prisma.timelineEvent.create({
      data: {
        escrowId: id,
        type: 'ITEM_DELIVERED',
        message: deliveryMessage,
        createdById: auth.userId,
      },
    })

    // Send email notification to buyer
    const escrowWithBuyer = await prisma.riftTransaction.findUnique({
      where: { id },
      include: { buyer: true },
    })
    if (escrowWithBuyer) {
      await sendItemReceivedEmail(
        escrowWithBuyer.buyer.email,
        id,
        escrowWithBuyer.itemTitle
      )
    }

    return NextResponse.json({ success: true, status: 'IN_TRANSIT' })
  } catch (error) {
    console.error('Mark delivered error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

