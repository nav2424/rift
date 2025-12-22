import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/stripe-disputes/[id]
 * Get a single Stripe dispute with related rift data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId } = await params

    const supabase = createServerClient()

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('stripe_disputes')
      .select('*')
      .eq('stripe_dispute_id', disputeId)
      .maybeSingle()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    // Get rift if available
    let rift = null
    if (dispute.rift_id) {
      rift = await prisma.riftTransaction.findUnique({
        where: { id: dispute.rift_id },
        select: {
          id: true,
          riftNumber: true,
          itemTitle: true,
          itemType: true,
          subtotal: true,
          currency: true,
          status: true,
          buyerId: true,
          sellerId: true,
          createdAt: true,
        },
      })
    }

    return NextResponse.json({ dispute, rift })
  } catch (error: any) {
    console.error('Get Stripe dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

