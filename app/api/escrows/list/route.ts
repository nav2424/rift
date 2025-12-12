import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.userId

    // Get all escrows where user is buyer or seller
    const escrows = await prisma.escrowTransaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        itemDescription: true,
        itemType: true,
        amount: true,
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

    return NextResponse.json({ escrows })
  } catch (error) {
    console.error('Get escrows error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

