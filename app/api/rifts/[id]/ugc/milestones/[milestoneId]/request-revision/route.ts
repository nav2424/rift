/**
 * Brand requests revision on a UGC milestone.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { requestRevision } from '@/lib/ugc/milestones'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { milestoneId } = await params
    const body = await request.json()
    const note = body.note ?? ''

    await requestRevision(milestoneId, auth.userId, note)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('UGC request revision error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
