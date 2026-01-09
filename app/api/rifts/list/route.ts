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

    // Check if user wants to see archived rifts
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const showOnlyArchived = searchParams.get('archived') === 'true'

    // Build where clause
    // Note: We don't filter by itemType in the base query to avoid Prisma enum validation errors
    // The database may have old enum values (DIGITAL, TICKETS) that don't match the Prisma schema
    let whereClause: any
    
    if (showOnlyArchived) {
      // Show only archived rifts (user-specific)
      whereClause = {
        OR: [
          { buyerId: userId, buyerArchived: true },
          { sellerId: userId, sellerArchived: true },
        ],
      }
    } else if (!includeArchived) {
      // Exclude archived rifts from main view (default behavior)
      whereClause = {
        AND: [
          {
            OR: [
              { buyerId: userId },
              { sellerId: userId },
            ],
          },
          {
            OR: [
              { buyerId: userId, buyerArchived: false },
              { sellerId: userId, sellerArchived: false },
            ],
          },
        ],
      }
    } else {
      // Include all rifts (archived and non-archived)
      whereClause = {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      }
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

    // Apply item type filter - skip for now to avoid enum validation errors
    // TODO: Re-enable once database enum matches Prisma schema
    // if (itemType && ['PHYSICAL', 'DIGITAL_GOODS', 'OWNERSHIP_TRANSFER', 'SERVICES'].includes(itemType)) {
    //   whereClause.itemType = itemType
    // }

    // Apply search query (search in item title, description, or rift number)
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim()
      // Try to parse as rift number (numeric search)
      const isNumericSearch = /^\d+$/.test(searchTerm)
      
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { itemTitle: { contains: searchTerm, mode: 'insensitive' } },
            { itemDescription: { contains: searchTerm, mode: 'insensitive' } },
            // Search riftNumber if it's a numeric query
            ...(isNumericSearch ? [{ riftNumber: parseInt(searchTerm) }] : []),
          ],
        },
      ]
    }

    // Map old enum values to new ones for compatibility
    const mapItemType = (itemType: string): string => {
      if (itemType === 'LICENSE_KEYS' || itemType === 'DIGITAL') return 'DIGITAL_GOODS'
      if (itemType === 'TICKETS') return 'OWNERSHIP_TRANSFER'
      return itemType
    }

    // Get total count for pagination
    let total: number
    let rifts: any[]

    try {
      total = await prisma.riftTransaction.count({
        where: whereClause,
      })

      // Get paginated rifts where user is buyer or seller
      rifts = await prisma.riftTransaction.findMany({
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
    } catch (error: any) {
      // If Prisma fails due to enum deserialization, use raw SQL
      if (error?.message?.includes('not found in enum') || error?.message?.includes('ItemType')) {
        console.warn('Prisma enum deserialization failed, using raw SQL:', error.message)
        
        // Build SQL WHERE clause
        let conditions: string[] = []
        const params: any[] = [userId, userId]
        let paramIndex = 3
        
        // Handle archive filtering - use the same logic as Prisma query above
        if (showOnlyArchived) {
          // Show only archived rifts (user-specific)
          conditions.push(`(("buyerId" = $1 AND "buyerArchived" = true) OR ("sellerId" = $2 AND "sellerArchived" = true))`)
        } else if (!includeArchived) {
          // Exclude archived rifts from main view (default behavior)
          conditions.push(`(("buyerId" = $1 AND "buyerArchived" = false) OR ("sellerId" = $2 AND "sellerArchived" = false))`)
        } else {
          // Include all rifts (archived and non-archived)
          conditions.push(`("buyerId" = $1 OR "sellerId" = $2)`)
        }

        if (whereClause.status) {
          if (typeof whereClause.status === 'string') {
            conditions.push(`"status" = $${paramIndex}`)
            params.push(whereClause.status)
            paramIndex++
          } else if (whereClause.status.in) {
            const placeholders = whereClause.status.in.map((_: any, i: number) => `$${paramIndex + i}`).join(',')
            conditions.push(`"status" IN (${placeholders})`)
            params.push(...whereClause.status.in)
            paramIndex += whereClause.status.in.length
          }
        }

        // Handle search query in raw SQL
        if (whereClause.AND) {
          const searchConditions: string[] = []
          whereClause.AND.forEach((condition: any) => {
            if (condition.OR) {
              condition.OR.forEach((orCondition: any) => {
                if (orCondition.itemTitle?.contains) {
                  searchConditions.push(`LOWER("itemTitle") LIKE $${paramIndex}`)
                  params.push(`%${orCondition.itemTitle.contains.toLowerCase()}%`)
                  paramIndex++
                }
                if (orCondition.itemDescription?.contains) {
                  searchConditions.push(`LOWER("itemDescription") LIKE $${paramIndex}`)
                  params.push(`%${orCondition.itemDescription.contains.toLowerCase()}%`)
                  paramIndex++
                }
                if (orCondition.riftNumber !== undefined) {
                  searchConditions.push(`"riftNumber" = $${paramIndex}`)
                  params.push(orCondition.riftNumber)
                  paramIndex++
                }
              })
              if (searchConditions.length > 0) {
                conditions.push(`(${searchConditions.join(' OR ')})`)
              }
            }
          })
        }

        const whereClauseSQL = conditions.join(' AND ')

        // Get count
        const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*)::int as count FROM "EscrowTransaction" WHERE ${whereClauseSQL}`,
          ...params
        )
        total = Number(countResult[0]?.count || 0)

        // Get paginated results with itemType cast to text to avoid enum validation
        const riftsRaw = await prisma.$queryRawUnsafe<any[]>(
          `SELECT 
            id, "riftNumber", "itemTitle", "itemDescription", 
            "itemType"::text as "itemType",
            amount, subtotal, "buyerFee", "sellerFee", "sellerNet",
            currency, status::text as status,
            "buyerId", "sellerId", "shippingAddress", notes, "paymentReference",
            "platformFee", "sellerPayoutAmount", "shipmentVerifiedAt", "trackingVerified",
            "deliveryVerifiedAt", "gracePeriodEndsAt", "autoReleaseScheduled",
            "eventDate", venue, "transferMethod", "downloadLink", "licenseKey",
            "serviceDate", "createdAt", "updatedAt",
            "buyerArchived", "sellerArchived", "buyerArchivedAt", "sellerArchivedAt"
          FROM "EscrowTransaction"
          WHERE ${whereClauseSQL}
          ORDER BY "createdAt" DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          ...params,
          limit,
          skip
        )

        // Get buyer and seller info
        const userIds = [...new Set(riftsRaw.flatMap((r: any) => [r.buyerId, r.sellerId]))]
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })

        const userMap = new Map(users.map(u => [u.id, u]))

        // Map raw results to expected format and convert enum values
        rifts = riftsRaw.map((rift: any) => ({
          ...rift,
          itemType: mapItemType(rift.itemType),
          buyer: userMap.get(rift.buyerId) || null,
          seller: userMap.get(rift.sellerId) || null,
        }))
      } else {
        throw error
      }
    }

    // Map itemType for any remaining old enum values
    rifts = rifts.map(rift => ({
      ...rift,
      itemType: mapItemType(rift.itemType),
    }))

    return NextResponse.json(createPaginatedResponse(rifts, page, limit, total))
  } catch (error: any) {
    console.error('Get rifts error:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

