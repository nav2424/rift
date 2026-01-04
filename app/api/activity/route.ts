import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { getUserActivities } from '@/lib/activity'

/**
 * GET /api/activity
 * Get user's personal activity feed (all activities)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    const activities = await getUserActivities(auth.userId, limit)

    return NextResponse.json({ activities })
  } catch (error: any) {
    console.error('Get user activities error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

