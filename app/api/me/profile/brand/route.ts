import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import {
  getLegacyBrandProfileByUserId,
  isMissingBrandCurrencyColumnError,
  upsertLegacyBrandProfile,
} from '@/lib/brand-profile-compat'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let profile
    try {
      profile = await prisma.brandProfile.findUnique({
        where: { userId: auth.userId },
        select: {
          id: true,
          userId: true,
          companyName: true,
          industry: true,
          website: true,
          logo: true,
          bio: true,
          monthlyBudget: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (error) {
      if (!isMissingBrandCurrencyColumnError(error)) {
        throw error
      }
      profile = await getLegacyBrandProfileByUserId(auth.userId)
    }

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

    let profile
    try {
      profile = await prisma.brandProfile.upsert({
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
        select: {
          id: true,
          userId: true,
          companyName: true,
          industry: true,
          website: true,
          logo: true,
          bio: true,
          monthlyBudget: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (error) {
      if (!isMissingBrandCurrencyColumnError(error)) {
        throw error
      }

      profile = await upsertLegacyBrandProfile({
        userId: auth.userId,
        companyName: companyName || 'Brand',
        industry,
        website,
        logo,
        bio,
        monthlyBudget,
      })
    }

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
