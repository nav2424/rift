import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { proposeAmendment } from '@/lib/ugc/amendments'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: riftId } = await params
    const body = await request.json()
    const patchJson = body.patchJson as Record<string, unknown>
    if (!patchJson || typeof patchJson !== 'object') {
      return NextResponse.json({ error: 'patchJson is required' }, { status: 400 })
    }

    const amendmentId = await proposeAmendment(riftId, auth.userId, patchJson)
    return NextResponse.json({ amendmentId }, { status: 201 })
  } catch (error: any) {
    console.error('Propose amendment error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}

