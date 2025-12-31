import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * POST /api/rifts/[id]/dispute
 * Create a draft dispute
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

    const { id: riftId } = await params
    const userId = auth.userId

    // Check user verification status before allowing dispute creation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        phoneVerified: true,
        email: true,
        phone: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Require email and phone verification to open disputes
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'Email verification required',
          message: 'You must verify your email address before opening a dispute. Please verify your email in Settings.',
        },
        { status: 403 }
      )
    }

    if (!user.phoneVerified) {
      return NextResponse.json(
        { 
          error: 'Phone verification required',
          message: 'You must verify your phone number before opening a dispute. Please verify your phone in Settings.',
        },
        { status: 403 }
      )
    }

    // Get rift and verify user is buyer or seller
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        itemType: true,
        status: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if rift is in a state that allows disputes
    // Disputes can only be opened for active transactions after payment has been made
    const allowedStatuses = [
      'FUNDED', 
      'PROOF_SUBMITTED', 
      'UNDER_REVIEW', 
      'DELIVERED_PENDING_RELEASE', 
      'IN_PROGRESS',
      'IN_TRANSIT',
      'AWAITING_SHIPMENT',
    ]
    
    if (!allowedStatuses.includes(rift.status)) {
      return NextResponse.json(
        { error: `Cannot open dispute in current status: ${rift.status}. Disputes can only be opened for active transactions after payment has been made.` },
        { status: 400 }
      )
    }

    // Check if there's already an active dispute
    const supabase = createServerClient()
    const { data: existingDispute } = await supabase
      .from('disputes')
      .select('id, status')
      .eq('rift_id', riftId)
      .in('status', ['draft', 'submitted', 'needs_info', 'under_review'])
      .single()

    if (existingDispute) {
      return NextResponse.json({
        success: true,
        disputeId: existingDispute.id,
        status: existingDispute.status,
      })
    }

    // Create draft dispute
    const actorRole = isBuyer ? 'buyer' : 'seller'
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert({
        rift_id: riftId,
        opened_by: userId,
        status: 'draft',
        reason: 'other', // Will be updated in next step
        category_snapshot: rift.itemType,
        summary: '',
      })
      .select()
      .single()

    if (disputeError || !dispute) {
      console.error('Create dispute error:', disputeError)
      return NextResponse.json(
        { error: 'Failed to create dispute', details: disputeError?.message },
        { status: 500 }
      )
    }

    // Create dispute action
    await supabase.from('dispute_actions').insert({
      dispute_id: dispute.id,
      actor_id: userId,
      actor_role: actorRole,
      action_type: 'created',
      note: 'Draft dispute created',
    })

    return NextResponse.json({
      success: true,
      disputeId: dispute.id,
      status: dispute.status,
    })
  } catch (error: any) {
    console.error('Create dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/rifts/[id]/dispute
 * Get existing dispute for this rift
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: riftId } = await params
    const userId = auth.userId

    // Get rift and verify access
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get dispute
    const supabase = createServerClient()
    const { data: dispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('rift_id', riftId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!dispute) {
      return NextResponse.json({ dispute: null })
    }

    return NextResponse.json({ dispute })
  } catch (error: any) {
    console.error('Get dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
