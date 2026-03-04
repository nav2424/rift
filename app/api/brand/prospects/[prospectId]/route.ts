import { NextRequest, NextResponse } from 'next/server'
import { InfluencerProspectStatus } from '@prisma/client'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
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

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value == null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date provided')
  }
  return parsed
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid numeric value provided')
  }
  return parsed
}

async function getBrandProfileId(userId: string) {
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { userId },
    select: { id: true },
  })

  return brandProfile?.id ?? null
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prospectId } = await params
    const brandProfileId = await getBrandProfileId(auth.userId)
    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'Please complete your brand profile before editing prospects.' },
        { status: 400 }
      )
    }

    const existing = await withProspectsSchemaRetry(() =>
      prisma.influencerProspect.findFirst({
        where: { id: prospectId, brandProfileId },
        select: { id: true },
      })
    )

    if (!existing) {
      return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 })
    }

    const body = await request.json()

    if (body.status && !ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid prospect status.' }, { status: 400 })
    }

    const prospect = await withProspectsSchemaRetry(() =>
      prisma.influencerProspect.update({
        where: { id: prospectId },
        data: {
          ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
          ...(body.handle !== undefined ? { handle: String(body.handle || '').trim() || null } : {}),
          ...(body.platform !== undefined ? { platform: String(body.platform || '').trim() || null } : {}),
          ...(body.contactEmail !== undefined ? { contactEmail: String(body.contactEmail || '').trim() || null } : {}),
          ...(body.contactPhone !== undefined ? { contactPhone: String(body.contactPhone || '').trim() || null } : {}),
          ...(body.outreachDate !== undefined ? { outreachDate: parseOptionalDate(body.outreachDate) } : {}),
          ...(body.quotedRate !== undefined ? { quotedRate: parseOptionalNumber(body.quotedRate) } : {}),
          ...(body.quotedCurrency !== undefined
            ? { quotedCurrency: String(body.quotedCurrency || '').trim().toUpperCase() || 'CAD' }
            : {}),
          ...(body.expectedDeliverables !== undefined
            ? { expectedDeliverables: String(body.expectedDeliverables || '').trim() || null }
            : {}),
          ...(body.status !== undefined ? { status: body.status as InfluencerProspectStatus } : {}),
          ...(body.nextFollowUpDate !== undefined ? { nextFollowUpDate: parseOptionalDate(body.nextFollowUpDate) } : {}),
          ...(body.notes !== undefined ? { notes: String(body.notes || '').trim() || null } : {}),
        },
      })
    )

    return NextResponse.json({ prospect })
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prospectId } = await params
    const brandProfileId = await getBrandProfileId(auth.userId)
    if (!brandProfileId) {
      return NextResponse.json({ error: 'Brand profile not found.' }, { status: 404 })
    }

    const existing = await withProspectsSchemaRetry(() =>
      prisma.influencerProspect.findFirst({
        where: { id: prospectId, brandProfileId },
        select: { id: true },
      })
    )

    if (!existing) {
      return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 })
    }

    await withProspectsSchemaRetry(() =>
      prisma.influencerProspect.delete({
        where: { id: prospectId },
      })
    )

    return NextResponse.json({ success: true })
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
