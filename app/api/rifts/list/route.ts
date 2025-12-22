import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.userId
    const { page, limit, skip } = parsePaginationParams(request)

    // Get total count for pagination
    const total = await prisma.riftTransaction.count({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
    })

    // Get paginated rifts where user is buyer or seller
    const rifts = await prisma.riftTransaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      skip,
      take: limit,
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        itemDescription: true,
        itemType: true,
        amount: true,
        subtotal: true,
        buyerFee: true,
        sellerFee: true,
        sellerNet: true,
        currency: true,
        status: true,
        buyerId: true,
        sellerId: true,
        shippingAddress: true,
        notes: true,
        paymentReference: true,
        platformFee: true,
        sellerPayoutAmount: true,
        shipmentVerifiedAt: true,
        trackingVerified: true,
        deliveryVerifiedAt: true,
        gracePeriodEndsAt: true,
        autoReleaseScheduled: true,
        eventDate: true,
        venue: true,
        transferMethod: true,
        downloadLink: true,
        licenseKey: true,
        serviceDate: true,
        createdAt: true,
        updatedAt: true,
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(createPaginatedResponse(rifts, page, limit, total))
  } catch (error) {
    console.error('Get rifts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

