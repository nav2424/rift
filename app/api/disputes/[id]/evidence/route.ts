import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/disputes/[id]/evidence
 * Upload evidence metadata (file should already be uploaded to storage)
 */
export async function POST(
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
    const body = await request.json()
    const { type, storagePath, textContent, meta } = body

    // Validate type
    const validTypes = ['image', 'pdf', 'text', 'link', 'file']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get dispute and verify access
    const supabase = createServerClient()
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*, rift_id')
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
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Determine uploader role
    const uploaderRole = isBuyer ? 'buyer' : isSeller ? 'seller' : 'admin'

    // Check if evidence can be added based on dispute status
    if (isBuyer && !['draft', 'submitted', 'needs_info'].includes(dispute.status)) {
      return NextResponse.json(
        { error: 'Cannot add evidence in current dispute status' },
        { status: 400 }
      )
    }

    if (isSeller && !['submitted', 'needs_info', 'under_review'].includes(dispute.status)) {
      return NextResponse.json(
        { error: 'Cannot add evidence in current dispute status' },
        { status: 400 }
      )
    }

    // Create evidence record
    const { data: evidence, error: evidenceError } = await supabase
      .from('dispute_evidence')
      .insert({
        dispute_id: disputeId,
        uploader_id: userId,
        uploader_role: uploaderRole,
        type,
        storage_path: storagePath || null,
        text_content: textContent || null,
        meta: meta || {},
      })
      .select()
      .single()

    if (evidenceError || !evidence) {
      console.error('Create evidence error:', evidenceError)
      return NextResponse.json(
        { error: 'Failed to create evidence', details: evidenceError?.message },
        { status: 500 }
      )
    }

    // Create dispute action
    await supabase.from('dispute_actions').insert({
      dispute_id: disputeId,
      actor_id: userId,
      actor_role: uploaderRole,
      action_type: 'evidence_added',
      note: `Added ${type} evidence`,
      meta: { evidenceId: evidence.id },
    })

    return NextResponse.json({
      success: true,
      evidence,
    })
  } catch (error: any) {
    console.error('Add evidence error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

