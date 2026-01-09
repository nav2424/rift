import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/rifts/[id]/archive
 * Archive or unarchive a rift (user-specific)
 * Archived rifts are hidden from main view but still exist for records
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
    const { archived } = await request.json() // true to archive, false to unarchive

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 })
    }

    // Fetch rift to determine if user is buyer or seller
    // Use raw SQL fallback if needed for enum issues or missing archive columns
    let rift: any
    try {
      rift = await prisma.riftTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          buyerArchived: true,
          sellerArchived: true,
        },
      })
    } catch (findError: any) {
      // Fallback to raw SQL if enum validation fails or archive columns don't exist
      if (findError?.message?.includes('enum') || 
          findError?.message?.includes('not found in enum') ||
          findError?.code === 'P2022' ||
          findError?.message?.includes('does not exist in the current database')) {
        
        // Check if archive columns exist before trying to SELECT them
        try {
          const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id, "buyerId", "sellerId", 
              COALESCE("buyerArchived", false) as "buyerArchived",
              COALESCE("sellerArchived", false) as "sellerArchived"
            FROM "EscrowTransaction"
            WHERE id = $1
          `, id)
          
          if (!fetchedRifts || fetchedRifts.length === 0) {
            return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
          }
          
          rift = fetchedRifts[0]
        } catch (rawError: any) {
          // If archive columns don't exist, SELECT without them
          if (rawError?.message?.includes('column') && rawError?.message?.includes('does not exist')) {
            const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
              SELECT id, "buyerId", "sellerId"
              FROM "EscrowTransaction"
              WHERE id = $1
            `, id)
            
            if (!fetchedRifts || fetchedRifts.length === 0) {
              return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
            }
            
            rift = {
              ...fetchedRifts[0],
              buyerArchived: false,
              sellerArchived: false,
            }
          } else {
            throw rawError
          }
        }
      } else {
        throw findError
      }
    }

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Check if user has access (must be buyer or seller)
    const isBuyer = rift.buyerId === auth.userId
    const isSeller = rift.sellerId === auth.userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if archive columns exist before trying to update
    try {
      // Update the appropriate archive field
      const updateData: any = {}
      if (isBuyer) {
        updateData.buyerArchived = archived
        updateData.buyerArchivedAt = archived ? new Date() : null
      }
      if (isSeller) {
        updateData.sellerArchived = archived
        updateData.sellerArchivedAt = archived ? new Date() : null
      }

      await prisma.riftTransaction.update({
        where: { id },
        data: updateData,
      })
    } catch (updateError: any) {
      // If archive columns don't exist, use raw SQL
      if (updateError?.code === 'P2022' || updateError?.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Archive functionality is not available yet. Please run the database migration first.',
            message: 'The archive feature requires a database migration to be applied.'
          },
          { status: 503 }
        )
      }
      throw updateError
    }

    return NextResponse.json({ 
      success: true,
      archived,
      message: archived ? 'Rift archived' : 'Rift unarchived'
    })
  } catch (error: any) {
    console.error('Archive rift error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

