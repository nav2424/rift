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

    const rift = await prisma.riftTransaction.findUnique({
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
          createdBy: {
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
      console.warn('Supabase not configured or error fetching disputes:', supabaseError?.message)
      disputes = []
    }

    return NextResponse.json({
      ...rift,
      timelineEvents,
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

