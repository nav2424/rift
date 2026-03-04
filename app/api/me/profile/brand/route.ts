import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await prisma.brandProfile.findUnique({
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
    const { companyName, industry, website, logo, bio, monthlyBudget, currency } = body

    const profile = await prisma.brandProfile.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        companyName: companyName || 'Brand',
        industry, website, logo, bio,
        monthlyBudget,
        currency: currency || 'CAD',
      },
      update: {
        companyName, industry, website, logo, bio,
        monthlyBudget, currency,
      },
    })

    // Also set platform role on user
    await prisma.user.update({
      where: { id: auth.userId },
      data: { platformRole: 'BRAND' } as any,
    })

    return NextResponse.json({ profile })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
