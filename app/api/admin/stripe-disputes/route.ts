import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'

/**
 * GET /api/admin/stripe-disputes
 * List all Stripe disputes with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const riftIdFilter = searchParams.get('rift_id')

    const supabase = createServerClient()

    let query = supabase
      .from('stripe_disputes')
      .select('*')
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    if (riftIdFilter) {
      query = query.eq('rift_id', riftIdFilter)
    }

    const { data: disputes, error } = await query

    if (error) {
      console.error('Error fetching Stripe Dispute:', error)
      return NextResponse.json(
        { error: 'Failed to fetch disputes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ Dispute: disputes || [] })
  } catch (error: any) {
    console.error('Get Stripe disputes error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

