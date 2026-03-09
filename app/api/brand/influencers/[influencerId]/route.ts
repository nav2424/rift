import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import {
  deleteInfluencerInActivity,
  updateInfluencerInActivity,
} from '@/lib/brand-activity-store'

const ALLOWED_INFLUENCER_STATUSES = new Set(['ACTIVE', 'ON_HOLD', 'ARCHIVED'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ influencerId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { influencerId } = await params
    const body = await request.json()

    if (body.status && !ALLOWED_INFLUENCER_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid influencer status.' }, { status: 400 })
    }

    const influencer = await updateInfluencerInActivity(auth.userId, influencerId, body)
    if (!influencer) return NextResponse.json({ error: 'Influencer not found.' }, { status: 404 })

    return NextResponse.json({ influencer })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ influencerId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { influencerId } = await params
    const deleted = await deleteInfluencerInActivity(auth.userId, influencerId)
    if (!deleted) return NextResponse.json({ error: 'Influencer not found.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
