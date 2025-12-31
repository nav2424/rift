import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/disputes/[id]/evidence
 * List all evidence for a dispute (buyer/seller/admin)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId } = await params
    const userId = auth.userId
    const isAdmin = auth.userRole === 'ADMIN'

    // Get dispute and verify access
    const supabase = createServerClient()
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('rift_id, status, opened_by')
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    // Get rift to determine role
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        buyerId: true,
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    const isBuyer = rift.buyerId === userId
    const isSeller = rift.sellerId === userId

    // Access control: Admin can always view, buyer/seller can view after dispute is submitted
    if (!isAdmin && !isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buyers and sellers can only view evidence after dispute is submitted
    if (!isAdmin && !['submitted', 'needs_info', 'under_review', 'resolved', 'closed'].includes(dispute.status)) {
      return NextResponse.json(
        { error: 'Evidence can only be viewed after dispute is submitted' },
        { status: 403 }
      )
    }

    // Get all evidence
    const { data: evidence, error: evidenceError } = await supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: false })

    if (evidenceError) {
      console.error('Get evidence error:', evidenceError)
      return NextResponse.json(
        { error: 'Failed to get evidence', details: evidenceError.message },
        { status: 500 }
      )
    }

    // For non-admin users, don't include signed URLs in list (they need to request individually)
    const evidenceList = evidence?.map(ev => ({
      id: ev.id,
      type: ev.type,
      uploaderRole: ev.uploader_role,
      uploaderId: ev.uploader_id,
      createdAt: ev.created_at,
      hasFile: !!ev.storage_path,
      hasText: !!ev.text_content,
      textContent: ev.text_content ? ev.text_content.substring(0, 100) + (ev.text_content.length > 100 ? '...' : '') : null,
      fileName: ev.meta?.fileName || null,
      fileSize: ev.meta?.fileSize || null,
    })) || []

    return NextResponse.json({
      evidence: evidenceList,
      count: evidenceList.length,
    })
  } catch (error: any) {
    console.error('List evidence error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
