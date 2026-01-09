import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { canTransition, getUserRole } from '@/lib/rules'
import { rollbackBalance } from '@/lib/balance'
import { EscrowStatus } from '@prisma/client'

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
    
    // Try Prisma first, fallback to raw SQL if enum validation fails
    let rift: any
    let buyer: any
    let seller: any
    
    try {
      rift = await prisma.riftTransaction.findUnique({
        where: { id },
        include: {
          buyer: true,
          seller: true,
        },
      })
      
      if (rift) {
        buyer = rift.buyer
        seller = rift.seller
      }
    } catch (findError: any) {
      // If Prisma fails due to enum validation, use raw SQL fallback
      if (findError?.message?.includes('enum') || findError?.message?.includes('not found in enum')) {
        console.warn('Prisma enum validation failed in cancel route, using raw SQL fallback:', findError.message)
        
        // Fetch rift using raw SQL with text casting to avoid enum validation
        const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            id, "riftNumber", "itemTitle", "itemDescription", 
            "itemType"::text as "itemType", subtotal, "buyerFee", "sellerFee", "sellerNet",
            currency, "buyerId", "sellerId", status::text as status,
            "riskScore", amount, "platformFee", "sellerPayoutAmount", "createdAt", "updatedAt"
          FROM "EscrowTransaction"
          WHERE id = $1
        `, id)
        
        if (!fetchedRifts || fetchedRifts.length === 0) {
          return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
        }
        
        const fetchedRift = fetchedRifts[0]
        rift = fetchedRift
        
        // Fetch buyer and seller separately
        buyer = await prisma.user.findUnique({
          where: { id: fetchedRift.buyerId },
        })
        
        seller = await prisma.user.findUnique({
          where: { id: fetchedRift.sellerId },
        })
      } else {
        // Re-throw if it's not an enum error
        throw findError
      }
    }

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Check if user is actually the buyer (direct ID comparison)
    const isBuyer = rift.buyerId === auth.userId
    const isSeller = rift.sellerId === auth.userId
    const isAdmin = auth.userRole === 'ADMIN'

    // Get role using helper function, but also check direct ID match
    const userRole = getUserRole(
      auth.userId,
      rift.buyerId,
      rift.sellerId,
      auth.userRole
    )

    // Only buyer can cancel - check both the role and direct ID match
    if (!isBuyer && userRole !== 'BUYER' && !isAdmin) {
      console.error('Cancel permission denied:', {
        userId: auth.userId,
        buyerId: rift.buyerId,
        sellerId: rift.sellerId,
        isBuyer,
        isSeller,
        userRole,
        authUserRole: auth.userRole
      })
      return NextResponse.json({ 
        error: 'Only buyer can cancel rifts',
        debug: process.env.NODE_ENV === 'development' ? {
          userId: auth.userId,
          buyerId: rift.buyerId,
          sellerId: rift.sellerId,
          isBuyer,
          userRole
        } : undefined
      }, { status: 403 })
    }

    // Allow cancellation from DRAFT, AWAITING_PAYMENT, or FUNDED (new system)
    // Also support legacy AWAITING_SHIPMENT
    const canCancel = ['DRAFT', 'AWAITING_PAYMENT', 'FUNDED', 'AWAITING_SHIPMENT'].includes(rift.status)
    
    if (!canCancel) {
      return NextResponse.json(
        { error: 'Cannot cancel in current status. Rift must be in DRAFT, AWAITING_PAYMENT, or FUNDED status.' },
        { status: 400 }
      )
    }

    // Use CANCELED for new system (DRAFT, FUNDED) or legacy (AWAITING_PAYMENT, AWAITING_SHIPMENT)
    const canceledStatus: EscrowStatus = 
      ['DRAFT', 'FUNDED', 'AWAITING_PAYMENT'].includes(rift.status) ? 'CANCELED' : 'CANCELLED'
    
    // At this point, we know the user is a buyer (verified above), so use 'BUYER' as the role
    // Or use ADMIN if they're an admin. This ensures type safety.
    const actorRole: 'BUYER' | 'SELLER' | 'ADMIN' = isAdmin ? 'ADMIN' : 'BUYER'
    
    if (!canTransition(rift.status, canceledStatus, actorRole)) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      )
    }

    // Store old status before updating (needed for rollback)
    const oldStatus = rift.status

    // Rollback balance if payment was already made (FUNDED or AWAITING_SHIPMENT means payment was received)
    // Do this BEFORE updating status, as rollbackBalance checks the current status
    if (oldStatus === 'FUNDED' || oldStatus === 'AWAITING_SHIPMENT') {
      try {
        // Rollback balance using subtotal
        await prisma.user.update({
          where: { id: rift.sellerId },
          data: {
            availableBalance: {
              decrement: rift.subtotal,
            },
            pendingBalance: {
              decrement: rift.subtotal,
            },
          },
        })
      } catch (error) {
        console.error('Error rolling back balance:', error)
        // Continue with cancellation even if rollback fails
      }
    }

    // Update rift status
    await prisma.riftTransaction.update({
      where: { id },
      data: { status: canceledStatus },
    })

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: id,
        type: 'RIFT_CANCELLED',
        message: 'Rift cancelled by buyer',
        createdById: auth.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel rift error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

