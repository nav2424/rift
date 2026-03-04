import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: auth.userId },
    })

    return NextResponse.json({ profile })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { displayName, bio, niche, secondaryNiches, platform, handle, followers, avgViews, avgLikes, engagementRate, postRate, storyRate, videoRate, packageRate, currency, portfolioUrls } = body

    const profile = await prisma.creatorProfile.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        displayName: displayName || 'Creator',
        bio, niche, secondaryNiches, platform, handle,
        followers: followers || 0,
        avgViews: avgViews || 0,
        avgLikes: avgLikes || 0,
        engagementRate: engagementRate || 0,
        postRate, storyRate, videoRate, packageRate,
        currency: currency || 'CAD',
        portfolioUrls: portfolioUrls || [],
      },
      update: {
        displayName, bio, niche, secondaryNiches, platform, handle,
        followers, avgViews, avgLikes, engagementRate,
        postRate, storyRate, videoRate, packageRate, currency, portfolioUrls,
      },
    })

    // Also set platform role on user
    await prisma.user.update({
      where: { id: auth.userId },
      data: { platformRole: 'CREATOR' } as any,
    })

    return NextResponse.json({ profile })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
