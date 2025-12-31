import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/disputes/[id]/evidence/[evidenceId]/view
 * Buyer/Seller/Admin views evidence file (returns signed URL or content)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId, evidenceId } = await params
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

    // Get evidence
    const { data: evidence, error: evidenceError } = await supabase
      .from('dispute_evidence')
      .select('*')
      .eq('id', evidenceId)
      .eq('dispute_id', disputeId)
      .single()

    if (evidenceError || !evidence) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      )
    }

    // If text content, return as JSON
    if (evidence.text_content) {
      return NextResponse.json({
        id: evidence.id,
        type: evidence.type,
        textContent: evidence.text_content,
        createdAt: evidence.created_at,
        uploaderRole: evidence.uploader_role,
      })
    }

    // If storage path, get signed URL
    if (evidence.storage_path) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('dispute-evidence')
        .createSignedUrl(evidence.storage_path, 3600) // 1 hour expiry

      if (urlError || !urlData) {
        console.error('Signed URL error:', urlError)
        return NextResponse.json(
          { error: 'Failed to generate view URL', details: urlError?.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        id: evidence.id,
        type: evidence.type,
        url: urlData.signedUrl,
        fileName: evidence.meta?.fileName || 'file',
        mimeType: evidence.meta?.mimeType || 'application/octet-stream',
        createdAt: evidence.created_at,
        uploaderRole: evidence.uploader_role,
      })
    }

    return NextResponse.json(
      { error: 'Evidence has no file or text content' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('View evidence error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

