import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { sendEscrowCreatedEmail } from '@/lib/email'
import { generateNextRiftNumber } from '@/lib/rift-number'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet, getFeeBreakdown } from '@/lib/fees'

export async function POST(request: NextRequest) {
  try {
    // Enhanced logging before auth check
    const authHeader = request.headers.get('authorization')
    const cookieHeader = request.headers.get('cookie')
    console.log('Create escrow request:', {
      hasAuthHeader: authHeader ? 'present' : 'missing',
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) : 'none',
      hasCookies: cookieHeader ? 'present' : 'missing',
    })
    
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      console.error('Create escrow: No auth found after getAuthenticatedUser')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Create escrow: Auth successful', { userId: auth.userId, isMobile: auth.isMobile })

    const body = await request.json()
    const {
      itemTitle,
      itemDescription,
      itemType,
      amount,
      currency,
      creatorRole, // 'BUYER' or 'SELLER' - who is creating the escrow
      sellerId,
      sellerEmail,
      buyerId,
      buyerEmail,
      partnerId, // Generic partner ID (buyer or seller depending on creatorRole)
      partnerEmail, // Generic partner email
      shippingAddress,
      notes,
      eventDate,
      venue,
      transferMethod,
      downloadLink,
      licenseKey,
      serviceDate,
    } = body

    // Validation
    if (!itemTitle || !itemDescription || !amount || !itemType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Type-specific validation (only require shipping address if creator is buyer)
    if (itemType === 'PHYSICAL' && creatorRole === 'BUYER' && !shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required for physical items' },
        { status: 400 }
      )
    }
    if (itemType === 'TICKETS' && (!eventDate || !venue || !transferMethod)) {
      return NextResponse.json(
        { error: 'Event date, venue, and transfer method are required for tickets' },
        { status: 400 }
      )
    }
    if (itemType === 'DIGITAL' && !downloadLink) {
      return NextResponse.json(
        { error: 'Download link is required for digital items' },
        { status: 400 }
      )
    }
    if (itemType === 'SERVICES' && !serviceDate) {
      return NextResponse.json(
        { error: 'Service date is required for services' },
        { status: 400 }
      )
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

    // Validate that creator is not creating escrow with themselves
    const partnerUserId = isCreatorBuyer ? seller.id : buyer.id
    if (partnerUserId === auth.userId) {
      return NextResponse.json(
        { error: 'You cannot create an escrow with yourself' },
        { status: 400 }
      )
    }

    // Generate next sequential rift number
    const riftNumber = await generateNextRiftNumber()

    // Calculate fees
    const subtotal = parseFloat(amount)
    const buyerFee = calculateBuyerFee(subtotal)
    const sellerFee = calculateSellerFee(subtotal)
    const sellerNet = calculateSellerNet(subtotal)

    // Create rift (escrow) in AWAITING_PAYMENT status - buyer can pay or cancel
    const escrow = await prisma.escrowTransaction.create({
      data: {
        riftNumber,
        itemTitle,
        itemDescription,
        itemType: itemType || 'PHYSICAL',
        subtotal,
        buyerFee,
        sellerFee,
        sellerNet,
        currency: currency || 'CAD',
        buyerId: buyer.id,
        sellerId: seller.id,
        shippingAddress: shippingAddress || null,
        notes: notes || null,
        eventDate: eventDate || null,
        venue: venue || null,
        transferMethod: transferMethod || null,
        downloadLink: downloadLink || null,
        licenseKey: licenseKey || null,
        serviceDate: serviceDate || null,
        status: 'AWAITING_PAYMENT',
        // Legacy fields for backward compatibility
        amount: subtotal,
        platformFee: sellerFee,
        sellerPayoutAmount: sellerNet,
      },
    })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        escrowId: escrow.id,
        type: 'ESCROW_CREATED',
        message: `Escrow created for ${itemTitle}`,
        createdById: auth.userId,
      },
    })

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
        escrow.id,
        itemTitle,
        parseFloat(amount),
        currency || 'CAD'
      )
    }

    return NextResponse.json({ escrowId: escrow.id }, { status: 201 })
  } catch (error: any) {
    console.error('Create escrow error:', error)
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

