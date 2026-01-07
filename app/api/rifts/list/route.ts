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

    // Get filter parameters from query string
    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status') // 'all' | 'active' | 'completed' | 'cancelled'
    const searchQuery = searchParams.get('search') // Search query string
    const itemType = searchParams.get('itemType') // Filter by item type

    // Build where clause
    const whereClause: any = {
      OR: [
        { buyerId: userId },
        { sellerId: userId },
      ],
      // Exclude invalid enum values (LICENSE_KEYS is no longer in the enum)
      itemType: {
        in: ['PHYSICAL', 'DIGITAL_GOODS', 'OWNERSHIP_TRANSFER', 'SERVICES'],
      },
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'active') {
        whereClause.status = {
          in: ['AWAITING_PAYMENT', 'AWAITING_SHIPMENT', 'FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'IN_TRANSIT', 'DELIVERED_PENDING_RELEASE'],
        }
      } else if (statusFilter === 'completed') {
        whereClause.status = 'RELEASED'
      } else if (statusFilter === 'cancelled') {
        whereClause.status = {
          in: ['CANCELLED', 'CANCELED', 'REFUNDED'],
        }
      } else if (statusFilter === 'disputed') {
        whereClause.status = 'DISPUTED'
      }
    }

    // Apply item type filter
    if (itemType) {
      whereClause.itemType = itemType
    }

    // Apply search query (search in item title, description, or rift number)
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { itemTitle: { contains: searchTerm, mode: 'insensitive' } },
            { itemDescription: { contains: searchTerm, mode: 'insensitive' } },
            // For PostgreSQL, we can search in riftNumber via raw query, but for now just search title/description
          ],
        },
      ]
    }

    // Get total count for pagination
    const total = await prisma.riftTransaction.count({
      where: whereClause,
    })

    // Get paginated rifts where user is buyer or seller
    const rifts = await prisma.riftTransaction.findMany({
      where: whereClause,
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

