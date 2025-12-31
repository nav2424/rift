import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/disputes
 * Get dispute queue for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const reason = searchParams.get('reason')

    // Get Supabase client
    let supabase
    try {
      supabase = createServerClient()
    } catch (supabaseError: any) {
      console.error('Supabase configuration error:', supabaseError)
      // Check if it's a configuration error
      if (supabaseError?.message?.includes('Supabase configuration missing')) {
        return NextResponse.json(
          {
            error: 'Supabase configuration missing',
            details: supabaseError.message + '\n\nPlease configure SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local',
          },
          { status: 500 }
        )
      }
      throw supabaseError
    }

    // Build query
    let query = supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by status
    if (status) {
      if (status === 'active') {
        query = query.in('status', ['submitted', 'needs_info', 'under_review'])
      } else if (status === 'all') {
        // Show all disputes - no status filter
      } else {
        query = query.eq('status', status)
      }
    } else {
      // Default: show ALL disputes (admin should see everything)
      // No status filter applied
    }

    // Filter by category
    if (category) {
      query = query.eq('category_snapshot', category)
    }

    // Filter by reason
    if (reason) {
      query = query.eq('reason', reason)
    }

    const { data: disputes, error: disputesError } = await query

    if (disputesError) {
      console.error('Get disputes error:', disputesError)
      return NextResponse.json(
        { error: 'Failed to fetch disputes', details: disputesError.message },
        { status: 500 }
      )
    }

    // Enrich with rift and user data
    const enrichedDisputes = await Promise.all(
      (disputes || []).map(async (dispute) => {
        const rift = await prisma.riftTransaction.findUnique({
          where: { id: dispute.rift_id },
          select: {
            id: true,
            riftNumber: true,
            itemTitle: true,
            subtotal: true,
            currency: true,
            itemType: true,
            eventDateTz: true,
            buyerId: true,
            sellerId: true,
            buyer: {
              select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                phoneVerified: true,
                idVerified: true,
                bankVerified: true,
              },
            },
            seller: {
              select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                phoneVerified: true,
                idVerified: true,
                bankVerified: true,
              },
            },
          },
        })

        const openedBy = await prisma.user.findUnique({
          where: { id: dispute.opened_by },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            phoneVerified: true,
            idVerified: true,
            bankVerified: true,
          },
        })

        return {
          ...dispute,
          rift,
          openedByUser: openedBy,
        }
      })
    )

    return NextResponse.json({ disputes: enrichedDisputes })
  } catch (error: any) {
    console.error('Get admin disputes error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
