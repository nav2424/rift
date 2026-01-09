import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = auth.userId
    const userRole = auth.userRole

    // Try Prisma first, fallback to raw SQL if enum validation fails
    let rift: any
    let buyer: any
    let seller: any
    
    try {
      rift = await prisma.riftTransaction.findUnique({
        where: { id },
        include: {
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
      })
      
      if (rift) {
        buyer = rift.buyer
        seller = rift.seller
      }
    } catch (findError: any) {
      // If Prisma fails due to enum validation or missing columns (migration not applied), use raw SQL fallback
      const isEnumError = findError?.message?.includes('enum') || 
                          findError?.message?.includes('not found in enum') ||
                          findError?.message?.includes("Value 'TICKETS'") ||
                          findError?.message?.includes("Value 'DIGITAL'")
      const isColumnError = findError?.code === 'P2022' || 
                            findError?.message?.includes('does not exist in the current database') ||
                            (findError?.message?.includes('column') && findError?.message?.includes('does not exist'))
      
      if (isEnumError || isColumnError) {
        // Silent fallback - these are expected until migrations are fully applied
        if (process.env.NODE_ENV === 'development' && isEnumError) {
          console.warn('Prisma query failed, using raw SQL fallback (expected behavior)')
        }
        
        // Check if archive columns exist in the database
        const columnCheck = await prisma.$queryRawUnsafe<any[]>(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'EscrowTransaction' AND column_name IN ('buyerArchived', 'sellerArchived')
        `)
        const hasArchiveColumns = columnCheck.length === 2
        
        // Build SELECT statement dynamically based on column existence
        let selectColumns = `
            id, "riftNumber", "itemTitle", "itemDescription", 
            "itemType"::text as "itemType", subtotal, "buyerFee", "sellerFee", "sellerNet",
            currency, "buyerId", "sellerId", "shippingAddress", notes,
            "eventDate", venue, "transferMethod", "seatDetails", quantity,
            "downloadLink", "fileStorageType", "licenseKey", "licenseKeyType",
            "licensePlatform", "licenseKeyRevealed", "serviceDate", "serviceScope",
            "serviceDeliverables", "completionCriteria", "allowsPartialRelease",
            milestones, status::text as status, "riskScore", amount, "platformFee", 
            "sellerPayoutAmount", "createdAt", "updatedAt", version`
        
        if (hasArchiveColumns) {
          selectColumns += `, "buyerArchived", "sellerArchived", "buyerArchivedAt", "sellerArchivedAt"`
        }
        
        // Fetch rift using raw SQL with text casting to avoid enum validation
        const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT ${selectColumns}
          FROM "EscrowTransaction"
          WHERE id = $1
        `, id)
        
        if (!fetchedRifts || fetchedRifts.length === 0) {
          return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
        }
        
        // Map the itemType back to the application layer value
        const mapItemTypeFromDB = (dbType: string): string => {
          if (dbType === 'TICKETS') return 'OWNERSHIP_TRANSFER'
          if (dbType === 'DIGITAL' || dbType === 'LICENSE_KEYS') return 'DIGITAL_GOODS'
          return dbType
        }
        
        const fetchedRift = fetchedRifts[0]
        rift = {
          ...fetchedRift,
          itemType: mapItemTypeFromDB(fetchedRift.itemType || fetchedRift.ItemType) as any,
          buyerArchived: fetchedRift.buyerArchived || false,
          sellerArchived: fetchedRift.sellerArchived || false,
          buyerArchivedAt: fetchedRift.buyerArchivedAt || null,
          sellerArchivedAt: fetchedRift.sellerArchivedAt || null,
        }
        
        // Fetch buyer and seller separately
        buyer = await prisma.user.findUnique({
          where: { id: fetchedRift.buyerId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
        
        seller = await prisma.user.findUnique({
          where: { id: fetchedRift.sellerId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      } else {
        // Re-throw if it's not an enum error
        throw findError
      }
    }

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Check access
    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId
    const isAdmin = userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch timeline events and disputes separately
    // Get ALL timeline events - no filters, no limits
    const timelineEvents = await prisma.timelineEvent.findMany({
        where: { escrowId: id },
        include: {
          User: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // Chronological order
        // No limit - get all events
    })

    // Fetch disputes from Supabase
    let disputes: any[] = []
    try {
      const supabase = createServerClient()
      const { data: supabaseDisputes, error: disputesError } = await supabase
        .from('disputes')
        .select('*')
        .eq('rift_id', id)
        .order('created_at', { ascending: false })

      if (!disputesError && supabaseDisputes) {
        // Enrich disputes with user information
        disputes = await Promise.all(
          supabaseDisputes.map(async (dispute) => {
            let raisedBy = null
            if (dispute.opened_by) {
              const user = await prisma.user.findUnique({
                where: { id: dispute.opened_by },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              })
              raisedBy = user
            }
            return {
              ...dispute,
              raisedBy: raisedBy || {
                id: dispute.opened_by || '',
                name: null,
                email: '',
              },
              createdAt: dispute.created_at,
              riftId: dispute.rift_id,
            }
          })
        )
      }
    } catch (supabaseError: any) {
      // If Supabase is not configured, just return empty disputes array
      console.warn('Supabase not configured or error fetching Dispute:', supabaseError?.message)
      disputes = []
    }

    // Attach buyer and seller if they were fetched separately (raw SQL fallback)
    if (buyer || seller) {
      rift = {
        ...rift,
        buyer: buyer || rift.buyer,
        seller: seller || rift.seller,
      }
    }
    
    return NextResponse.json({
      ...rift,
      timelineEvents: timelineEvents.map(e => ({
        ...e,
        createdBy: e.User ? {
          name: e.User.name ?? null,
          email: e.User.email ?? null,
        } : null,
        User: undefined, // Remove User from response
      })),
      disputes,
    })
  } catch (error: any) {
    console.error('Get rift error:', error)
    const errorMessage = error?.message || 'Internal server error'
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? error?.stack || errorMessage
      : undefined
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: errorMessage,
        ...(errorDetails && { details: errorDetails })
      },
      { status: 500 }
    )
  }
}

