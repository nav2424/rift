/**
 * Submit delivery for a UGC milestone (creator).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { submitDelivery } from '@/lib/ugc/milestones'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, milestoneId } = await params
    const body = await request.json()
    const { fileIds, note } = body

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'At least one fileId is required' }, { status: 400 })
    }

    const result = await submitDelivery(milestoneId, auth.userId, {
      fileIds,
      note: note ?? undefined,
    })

    return NextResponse.json({ deliveryId: result.deliveryId }, { status: 201 })
  } catch (error: any) {
    console.error('UGC submit delivery error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}
