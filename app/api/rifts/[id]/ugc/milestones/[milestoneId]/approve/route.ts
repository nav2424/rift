/**
 * Brand approves a UGC milestone (releases funds to creator).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { approveMilestone } from '@/lib/ugc/milestones'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { milestoneId } = await params
    await approveMilestone(milestoneId, auth.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('UGC approve milestone error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
