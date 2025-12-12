import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { getUserBadges } from '@/lib/badges'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    const userBadges = await getUserBadges(userId)

    const badges = userBadges.map((ub: any) => ({
      id: ub.id,
      code: ub.badge.code,
      label: ub.badge.label,
      description: ub.badge.description,
      icon: ub.badge.icon,
      awardedAt: ub.awardedAt,
    }))

    return NextResponse.json({ badges })
  } catch (error) {
    console.error('Get badges error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

