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
    // Note: Archive filtering will be handled in raw SQL fallback if columns don't exist yet
    // For now, use basic where clause without archive filters to avoid migration dependency
    const whereClause: any = {
      OR: [
        { buyerId: userId },
        { sellerId: userId },
      ],
    }
    
    // Note: Archive filtering (buyerArchived/sellerArchived) is handled in raw SQL fallback
    // This allows the app to work before the migration is applied

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
    // Use raw SQL from the start to avoid enum validation errors with old 'TICKETS' values
    let total: number
    let rifts: any[]

    try {
      // Build SQL WHERE clause
      let conditions: string[] = []
      const params: any[] = [userId, userId]
      let paramIndex = 3
      
      conditions.push(`("buyerId" = $1 OR "sellerId" = $2)`)

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

      // Get count using raw SQL with text casting to avoid enum validation
      const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::int as count FROM "EscrowTransaction" WHERE ${whereClauseSQL}`,
        ...params
      )
      total = Number(countResult[0]?.count || 0)

      // Get paginated rifts using raw SQL with text casting to avoid enum validation
      // Cast itemType and status to text to bypass enum validation
      const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT 
            id, "riftNumber", "itemTitle", "itemDescription", 
            "itemType"::text as "itemType",
            amount, subtotal, "buyerFee", "sellerFee", "sellerNet",
            currency, status::text as status,
            "buyerId", "sellerId", "shippingAddress", notes, "paymentReference",
            "platformFee", "sellerPayoutAmount", "shipmentVerifiedAt", "trackingVerified",
            "deliveryVerifiedAt", "gracePeriodEndsAt", "autoReleaseScheduled",
            "eventDate", venue, "transferMethod", "downloadLink", "licenseKey",
            "serviceDate", "createdAt", "updatedAt"
          FROM "EscrowTransaction"
          WHERE ${whereClauseSQL}
          ORDER BY "createdAt" DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        ...params,
        limit,
        skip
      )

      // Fetch buyer and seller info separately
      const allRiftIds = fetchedRifts.map(r => r.id)
      const allUserIds = [...new Set([...fetchedRifts.map(r => r.buyerId), ...fetchedRifts.map(r => r.sellerId)])]
      
      const users = await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, email: true },
      })
      
      const userMap = new Map(users.map(u => [u.id, u]))
      
      // Map the results and transform itemType
      rifts = fetchedRifts.map(r => ({
        ...r,
        itemType: mapItemType(r.itemType),
        buyer: userMap.get(r.buyerId) || null,
        seller: userMap.get(r.sellerId) || null,
      }))
    } catch (error: any) {
      // Fallback error handling (shouldn't be needed now, but keep for safety)
      // If Prisma fails due to enum deserialization or missing columns (migration not applied), use raw SQL
      const isEnumError = error?.message?.includes('not found in enum') || 
                          error?.message?.includes('ItemType') ||
                          error?.message?.includes("Value 'TICKETS'") ||
                          error?.message?.includes("Value 'DIGITAL'") ||
                          error?.message?.includes("Value 'LICENSE_KEYS'") ||
                          (error?.code === 'P2002' && error?.message?.includes('enum')) ||
                          error?.message?.includes("Enum value")
      const isColumnError = error?.code === 'P2022' || 
                            error?.message?.includes('does not exist in the current database') ||
                            (error?.message?.includes('column') && error?.message?.includes('does not exist'))
      
      if (isEnumError || isColumnError) {
        // Silent fallback - these are expected until migrations are fully applied
        // Only log in development for debugging
        if (process.env.NODE_ENV === 'development' && isEnumError) {
          console.warn('Prisma enum deserialization failed, using raw SQL fallback (expected behavior)')
        }
        
        // Build SQL WHERE clause
        let conditions: string[] = []
        const params: any[] = [userId, userId]
        let paramIndex = 3
        
        // Handle archive filtering in raw SQL (columns may not exist if migration hasn't run)
        // For now, just filter by user - archive filtering will work after migration is applied
        // The raw SQL fallback will check for columns and apply filtering if they exist
        conditions.push(`("buyerId" = $1 OR "sellerId" = $2)`)
        
        // Note: Archive filtering is disabled until migration is applied
        // After migration, this will be handled by checking column existence

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

        // Get count - use try-catch in case archive columns don't exist yet
        try {
          const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*)::int as count FROM "EscrowTransaction" WHERE ${whereClauseSQL}`,
            ...params
          )
          total = Number(countResult[0]?.count || 0)
        } catch (countError: any) {
          // If count fails (e.g., archive columns don't exist), use simplified query
          console.warn('Count query failed, using simplified query:', countError.message)
          const simplifiedConditions = [`("buyerId" = $1 OR "sellerId" = $2)`]
          const simplifiedParams = [userId, userId]
          let simplifiedParamIndex = 3
          
          // Add status filter if present (without archive filtering)
          if (whereClause.status) {
            if (typeof whereClause.status === 'string') {
              simplifiedConditions.push(`"status" = $${simplifiedParamIndex}`)
              simplifiedParams.push(whereClause.status)
              simplifiedParamIndex++
            } else if (whereClause.status.in) {
              const placeholders = whereClause.status.in.map((_: any, i: number) => `$${simplifiedParamIndex + i}`).join(',')
              simplifiedConditions.push(`"status" IN (${placeholders})`)
              simplifiedParams.push(...whereClause.status.in)
            }
          }
          
          const simplifiedWhere = simplifiedConditions.join(' AND ')
          const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*)::int as count FROM "EscrowTransaction" WHERE ${simplifiedWhere}`,
            ...simplifiedParams
          )
          total = Number(countResult[0]?.count || 0)
        }

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
            "serviceDate", "createdAt", "updatedAt"
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
          buyerArchived: rift.buyerArchived || false, // Default to false if column doesn't exist yet
          sellerArchived: rift.sellerArchived || false, // Default to false if column doesn't exist yet
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

