import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { rejectAmendment } from '@/lib/ugc/amendments'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; amendmentId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: riftId, amendmentId } = await params
    await rejectAmendment(riftId, amendmentId, auth.userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Reject amendment error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 })
  }
}

