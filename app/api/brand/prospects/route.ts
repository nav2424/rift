import { NextRequest, NextResponse } from 'next/server'
import { InfluencerProspectStatus } from '@prisma/client'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import {
  getLegacyBrandProfileIdByUserId,
  isMissingBrandCurrencyColumnError,
  upsertLegacyBrandProfile,
} from '@/lib/brand-profile-compat'
import {
  ensureInfluencerProspectsSchema,
  isMissingInfluencerProspectsTableError,
  ProspectsSchemaNotReadyError,
} from '@/lib/influencer-prospects-schema'

const ALLOWED_STATUSES = new Set<InfluencerProspectStatus>([
  'LEAD',
  'CONTACTED',
  'NEGOTIATING',
  'READY_TO_DEAL',
  'PASSED',
])

function parseOptionalDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date provided')
  }
  return parsed
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid numeric value provided')
  }
  return parsed
}

async function getBrandProfileId(userId: string) {
  try {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { userId },
      select: { id: true },
    })

    return brandProfile?.id ?? null
  } catch (error) {
    if (!isMissingBrandCurrencyColumnError(error)) {
      throw error
    }
    return getLegacyBrandProfileIdByUserId(userId)
  }
}

async function ensureBrandProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  let brandProfileId: string
  try {
    const brandProfile = await prisma.brandProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        companyName: user.name?.trim() || 'My Brand',
      },
      select: { id: true },
    })
    brandProfileId = brandProfile.id
  } catch (error) {
    if (!isMissingBrandCurrencyColumnError(error)) {
      throw error
    }

    const legacyProfile = await upsertLegacyBrandProfile({
      userId,
      companyName: user.name?.trim() || 'My Brand',
    })
    brandProfileId = legacyProfile.id
  }

  await prisma.user.update({
    where: { id: userId },
    data: { platformRole: 'BRAND' } as any,
  })

  return brandProfileId
}

async function withProspectsSchemaRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isMissingInfluencerProspectsTableError(error)) {
      throw error
    }

    await ensureInfluencerProspectsSchema()
    return operation()
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const brandProfileId = await getBrandProfileId(auth.userId)
    if (!brandProfileId) {
      return NextResponse.json({ prospects: [] })
    }

    const requestedStatus = request.nextUrl.searchParams.get('status')
    const whereClause = requestedStatus && ALLOWED_STATUSES.has(requestedStatus as InfluencerProspectStatus)
      ? { brandProfileId, status: requestedStatus as InfluencerProspectStatus }
      : { brandProfileId }

    const prospects = await withProspectsSchemaRetry(() =>
      prisma.influencerProspect.findMany({
        where: whereClause,
        orderBy: [{ updatedAt: 'desc' }],
      })
    )

    return NextResponse.json({ prospects })
  } catch (error: any) {
    if (error instanceof ProspectsSchemaNotReadyError) {
      // Keep page load functional even when schema migration has not been applied yet.
      return NextResponse.json({
        prospects: [],
        schemaNotReady: true,
        message: error.message,
      })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const brandProfileId = await ensureBrandProfile(auth.userId)

    const body = await request.json()
    const {
      name,
      handle,
      platform,
      contactEmail,
      contactPhone,
      outreachDate,
      quotedRate,
      quotedCurrency,
      expectedDeliverables,
      status,
      nextFollowUpDate,
      notes,
    } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Prospect name is required.' }, { status: 400 })
    }

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid prospect status.' }, { status: 400 })
    }

    const prospect = await withProspectsSchemaRetry(() =>
      prisma.influencerProspect.create({
        data: {
          brandProfileId,
          name: name.trim(),
          handle: typeof handle === 'string' ? handle.trim() || null : null,
          platform: typeof platform === 'string' ? platform.trim() || null : null,
          contactEmail: typeof contactEmail === 'string' ? contactEmail.trim() || null : null,
          contactPhone: typeof contactPhone === 'string' ? contactPhone.trim() || null : null,
          outreachDate: parseOptionalDate(outreachDate),
          quotedRate: parseOptionalNumber(quotedRate),
          quotedCurrency: typeof quotedCurrency === 'string' && quotedCurrency.trim() ? quotedCurrency.trim().toUpperCase() : 'CAD',
          expectedDeliverables: typeof expectedDeliverables === 'string' ? expectedDeliverables.trim() || null : null,
          status: (status as InfluencerProspectStatus) || 'LEAD',
          nextFollowUpDate: parseOptionalDate(nextFollowUpDate),
          notes: typeof notes === 'string' ? notes.trim() || null : null,
        },
      })
    )

    return NextResponse.json({ prospect }, { status: 201 })
  } catch (error: any) {
    if (error instanceof ProspectsSchemaNotReadyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
