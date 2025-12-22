import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/risk/users/[userId]
 * Get risk profile, restrictions, and enforcement actions for a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    const supabase = createServerClient()

    // Get risk profile
    const { data: riskProfile, error: riskError } = await supabase
      .from('risk_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (riskError) {
      console.error('Error fetching risk profile:', riskError)
    }

    // Get user restrictions
    const { data: restrictions, error: restrictionsError } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (restrictionsError) {
      console.error('Error fetching restrictions:', restrictionsError)
    }

    // Get last 50 enforcement actions
    const { data: enforcementActions, error: actionsError } = await supabase
      .from('enforcement_actions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (actionsError) {
      console.error('Error fetching enforcement actions:', actionsError)
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: true,
      },
    })

    return NextResponse.json({
      user,
      riskProfile: riskProfile || null,
      restrictions: restrictions || null,
      enforcementActions: enforcementActions || [],
    })
  } catch (error: any) {
    console.error('Get user risk error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

