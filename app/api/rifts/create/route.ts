import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { sendEscrowCreatedEmail } from '@/lib/email'
import { generateNextRiftNumber } from '@/lib/rift-number'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet, getFeeBreakdown } from '@/lib/fees'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { isCategoryBlocked } from '@/lib/risk/enforcement'
import { randomUUID } from 'crypto'
import { MIN_TRANSACTION_AMOUNT } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    // Enhanced logging before auth check
    const authHeader = request.headers.get('authorization')
    const cookieHeader = request.headers.get('cookie')
    console.log('Create rift request:', {
      hasAuthHeader: authHeader ? 'present' : 'missing',
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) : 'none',
      hasCookies: cookieHeader ? 'present' : 'missing',
    })
    
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      console.error('Create rift: No auth found after getAuthenticatedUser')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Create rift: Auth successful', { userId: auth.userId, isMobile: auth.isMobile })

    const body = await request.json()
    const {
      itemTitle,
      itemDescription,
      itemType,
      amount,
      currency,
      creatorRole, // 'BUYER' or 'SELLER' - who is creating the rift
      sellerId,
      sellerEmail,
      buyerId,
      buyerEmail,
      partnerId, // Generic partner ID (buyer or seller depending on creatorRole)
      partnerEmail, // Generic partner email
      notes,
      // Ticket-specific fields
      eventDate,
      venue,
      seatDetails,
      transferMethod,
      quantity,
      // Digital file-specific fields
      fileStorageType,
      downloadLink,
      // License key-specific fields
      licenseKey,
      licenseKeyType,
      licensePlatform,
      // Service-specific fields
      serviceDate,
      serviceScope,
      serviceDeliverables,
      completionCriteria,
      allowsPartialRelease,
      milestones,
    } = body

    // Validation
    if (!itemTitle || !itemDescription || !amount || !itemType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate minimum transaction amount
    const subtotal = parseFloat(amount)
    if (isNaN(subtotal) || subtotal < MIN_TRANSACTION_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum transaction amount is $${MIN_TRANSACTION_AMOUNT.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Type-specific validation
    if (itemType === 'TICKETS') {
      if (!eventDate || !venue || !seatDetails || !transferMethod) {
        return NextResponse.json(
          { error: 'Event date, venue, seat details, and transfer method are required for tickets' },
          { status: 400 }
        )
      }
    }
    if (itemType === 'DIGITAL') {
      // File storage type is optional during creation - seller will provide proof after payment
      // Only validate if they've provided a storage type
      if (fileStorageType === 'EXTERNAL_LINK' && !downloadLink) {
        return NextResponse.json(
          { error: 'Download link is required when using external link storage' },
          { status: 400 }
        )
      }
      // If license key is provided, validate license key fields are complete
      if (licenseKey && (!licenseKeyType || !licensePlatform)) {
        return NextResponse.json(
          { error: 'License key type and platform are required when providing a license key' },
          { status: 400 }
        )
      }
    }
    if (itemType === 'SERVICES') {
      if (!serviceDate || !serviceScope || !serviceDeliverables || !completionCriteria) {
        return NextResponse.json(
          { error: 'Service date, scope, deliverables, and completion criteria are required for services' },
          { status: 400 }
        )
      }
      
      // Validate milestones if partial release is enabled
      if (allowsPartialRelease) {
        if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
          return NextResponse.json(
            { error: 'At least one milestone is required when partial release is enabled' },
            { status: 400 }
          )
        }
        
        const subtotal = parseFloat(amount)
        const milestoneTotal = milestones.reduce((sum: number, m: any) => sum + (parseFloat(m.amount) || 0), 0)
        
        // Validate minimum transaction amount for total
        if (subtotal < MIN_TRANSACTION_AMOUNT) {
          return NextResponse.json(
            { error: `Minimum transaction amount is $${MIN_TRANSACTION_AMOUNT.toFixed(2)}` },
            { status: 400 }
          )
        }
        
        // Allow small rounding differences (0.01)
        if (Math.abs(milestoneTotal - subtotal) > 0.01) {
          return NextResponse.json(
            { error: `Milestone amounts (${milestoneTotal.toFixed(2)}) must equal the total rift amount (${subtotal.toFixed(2)})` },
            { status: 400 }
          )
        }
        
        // Validate each milestone has required fields
        for (let i = 0; i < milestones.length; i++) {
          const m = milestones[i]
          if (!m.title || m.amount === undefined || m.amount === null || !m.dueDate) {
            return NextResponse.json(
              { error: `Milestone ${i + 1} is missing required fields (title, amount, or due date)` },
              { status: 400 }
            )
          }
          if (parseFloat(m.amount) <= 0) {
            return NextResponse.json(
              { error: `Milestone ${i + 1} amount must be greater than 0` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Determine buyer and seller based on creator role
    let buyer, seller
    const isCreatorBuyer = creatorRole === 'BUYER' || !creatorRole // Default to buyer for backward compatibility
    
    if (isCreatorBuyer) {
      // Creator is buyer, find seller
      buyer = { id: auth.userId }
      
      // Support both old format (sellerId/sellerEmail) and new format (partnerId/partnerEmail)
      const targetSellerId = sellerId || partnerId
      const targetSellerEmail = sellerEmail || partnerEmail
      
      // Validate that seller information is provided
      if (!targetSellerId && !targetSellerEmail) {
        return NextResponse.json(
          { error: 'Seller information is required. Please select or enter a seller.' },
          { status: 400 }
        )
      }
      
      if (targetSellerId) {
        seller = await prisma.user.findUnique({ where: { id: targetSellerId } })
      } else if (targetSellerEmail) {
        seller = await prisma.user.findUnique({ where: { email: targetSellerEmail } })
      }
      
      if (!seller) {
        return NextResponse.json(
          { error: 'Seller not found. Seller must be registered.' },
          { status: 400 }
        )
      }
    } else {
      // Creator is seller, find buyer
      seller = { id: auth.userId }
      
      // Support both old format (buyerId/buyerEmail) and new format (partnerId/partnerEmail)
      const targetBuyerId = buyerId || partnerId
      const targetBuyerEmail = buyerEmail || partnerEmail
      
      // Validate that buyer information is provided
      if (!targetBuyerId && !targetBuyerEmail) {
        return NextResponse.json(
          { error: 'Buyer information is required. Please select or enter a buyer.' },
          { status: 400 }
        )
      }
      
      if (targetBuyerId) {
        buyer = await prisma.user.findUnique({ where: { id: targetBuyerId } })
      } else if (targetBuyerEmail) {
        buyer = await prisma.user.findUnique({ where: { email: targetBuyerEmail } })
      }
      
      if (!buyer) {
        return NextResponse.json(
          { error: 'Buyer not found. Buyer must be registered.' },
          { status: 400 }
        )
      }
    }

    // Validate that creator is not creating rift with themselves
    const partnerUserId = isCreatorBuyer ? seller.id : buyer.id
    if (partnerUserId === auth.userId) {
      return NextResponse.json(
        { error: 'You cannot create a rift with yourself' },
        { status: 400 }
      )
    }

    // Check if seller is blocked from this category
    const sellerIdToCheck = isCreatorBuyer ? seller.id : auth.userId
    const isBlocked = await isCategoryBlocked(sellerIdToCheck, itemType)
    if (isBlocked) {
      return NextResponse.json(
        { error: `You are restricted from creating rifts in the ${itemType} category. Contact support for more information.` },
        { status: 403 }
      )
    }

    // Generate next sequential rift number
    const riftNumber = await generateNextRiftNumber()

    // Calculate fees (subtotal already validated above)
    const buyerFee = calculateBuyerFee(subtotal)
    const sellerFee = calculateSellerFee(subtotal)
    const sellerNet = calculateSellerNet(subtotal)

    // Compute initial risk score (before creating rift)
    let initialRiskScore = 0
    try {
      const { computeRiftRisk } = await import('@/lib/risk/computeRisk')
      // Create temporary rift ID for risk calculation
      const tempRiftId = randomUUID()
      // We'll compute risk after creation, but prepare here
      initialRiskScore = 0 // Will be computed after creation
    } catch (error) {
      console.error('Risk score computation error (non-blocking):', error)
    }

    // Create rift (rift) in AWAITING_PAYMENT status - buyer can pay or cancel
    const rift = await prisma.riftTransaction.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        riftNumber,
        itemTitle,
        itemDescription,
        itemType: itemType || 'DIGITAL',
        subtotal,
        buyerFee,
        sellerFee,
        sellerNet,
        currency: currency || 'CAD',
        buyerId: buyer.id,
        sellerId: seller.id,
        shippingAddress: null,
        notes: notes || null,
        // Ticket-specific fields
        eventDate: eventDate || null,
        venue: venue || null,
        seatDetails: seatDetails || null,
        transferMethod: transferMethod || null,
        quantity: quantity ? parseInt(quantity) : null,
        // Digital file-specific fields
        downloadLink: downloadLink || null,
        fileStorageType: fileStorageType || null,
        // License key-specific fields
        licenseKey: licenseKey || null,
        licenseKeyType: licenseKeyType || null,
        licensePlatform: licensePlatform || null,
        licenseKeyRevealed: false,
        // Service-specific fields
        serviceDate: serviceDate || null,
        serviceScope: serviceScope || null,
        serviceDeliverables: serviceDeliverables || null,
        completionCriteria: completionCriteria || null,
        allowsPartialRelease: allowsPartialRelease || false,
        milestones: milestones && Array.isArray(milestones) && milestones.length > 0 ? milestones : undefined,
        status: 'AWAITING_PAYMENT',
        riskScore: initialRiskScore,
        // Legacy fields for backward compatibility
        amount: subtotal,
        platformFee: sellerFee,
        sellerPayoutAmount: sellerNet,
      },
    })

    // Compute and update risk score after creation (async, non-blocking)
    try {
      const { computeRiftRisk } = await import('@/lib/risk/computeRisk')
      const riskScore = await computeRiftRisk(rift.id)
      await prisma.riftTransaction.update({
        where: { id: rift.id },
        data: { riskScore },
      })
    } catch (error) {
      console.error('Risk score computation error (non-blocking):', error)
    }

    // Create timeline event - accurately show who created the rift
    const creatorName = isCreatorBuyer ? 'buyer' : 'seller'
    await prisma.timelineEvent.create({
      data: {
        id: randomUUID(),
        escrowId: rift.id,
        type: 'RIFT_CREATED',
        message: `Rift created by ${creatorName} for ${itemTitle}`,
        createdById: auth.userId,
      },
    })

    // Log immutable event for truth engine
    const requestMeta = extractRequestMetadata(request)
    const actorType: RiftEventActorType = isCreatorBuyer ? 'BUYER' : 'SELLER'
    await logEvent(
      rift.id,
      actorType,
      auth.userId,
      'RIFT_CREATED',
      {
        itemTitle,
        itemType,
        amount: subtotal,
        currency: currency || 'CAD',
        buyerId: buyer.id,
        sellerId: seller.id,
        creatorRole: isCreatorBuyer ? 'BUYER' : 'SELLER',
      },
      requestMeta
    )

    // Get buyer and seller info for email
    const buyerUser = await prisma.user.findUnique({
      where: { id: buyer.id },
    })
    const sellerUser = await prisma.user.findUnique({
      where: { id: seller.id },
    })

    // Send email notifications
    if (buyerUser && sellerUser) {
      await sendEscrowCreatedEmail(
        buyerUser.email,
        sellerUser.email,
        rift.id,
        itemTitle,
        parseFloat(amount),
        currency || 'CAD'
      )
    }

    return NextResponse.json({ riftId: rift.id }, { status: 201 })
  } catch (error: any) {
    console.error('Create rift error:', error)
    // Provide more detailed error message
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error?.message || 'Internal server error'
      : 'Internal server error'
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

