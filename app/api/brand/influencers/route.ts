import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import {
  createInfluencerInActivity,
  listInfluencersFromActivity,
} from '@/lib/brand-activity-store'

const ALLOWED_INFLUENCER_STATUSES = new Set(['ACTIVE', 'ON_HOLD', 'ARCHIVED'])

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const influencers = await listInfluencersFromActivity(auth.userId)
    return NextResponse.json({ influencers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!body?.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Influencer name is required.' }, { status: 400 })
    }

    if (body.status && !ALLOWED_INFLUENCER_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid influencer status.' }, { status: 400 })
    }

    const influencer = await createInfluencerInActivity(auth.userId, body)
    return NextResponse.json({ influencer }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
