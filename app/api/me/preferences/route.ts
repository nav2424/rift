import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { showInActivityFeed, showAmountsInFeed } = body

    const updateData: {
      showInActivityFeed?: boolean
      showAmountsInFeed?: boolean
    } = {}

    if (typeof showInActivityFeed === 'boolean') {
      updateData.showInActivityFeed = showInActivityFeed
    }

    if (typeof showAmountsInFeed === 'boolean') {
      updateData.showAmountsInFeed = showAmountsInFeed
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: updateData,
      select: {
        showInActivityFeed: true,
        showAmountsInFeed: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

