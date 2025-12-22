import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/disputes/[id]
 * Update draft dispute (reason, summary, sworn declaration)
 */
export async function PATCH(
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
    const { reason, summary, swornDeclaration, swornDeclarationText } = body

    // Get dispute and verify buyer owns it
    const supabase = createServerClient()
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single()

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      )
    }

    if (dispute.opened_by !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow updates to draft or needs_info status
    if (!['draft', 'needs_info'].includes(dispute.status)) {
      return NextResponse.json(
        { error: 'Cannot update dispute in current status' },
        { status: 400 }
      )
    }

    // Validate reason
    const validReasons = ['not_received', 'not_as_described', 'unauthorized', 'seller_nonresponsive', 'other']
    if (reason && !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate summary length (min 200 chars for submission, but allow shorter for draft)
    if (summary !== undefined && summary.length < 50) {
      return NextResponse.json(
        { error: 'Summary must be at least 50 characters' },
        { status: 400 }
      )
    }

    // Update dispute
    const updateData: any = {}
    if (reason !== undefined) updateData.reason = reason
    if (summary !== undefined) updateData.summary = summary
    if (swornDeclaration !== undefined) updateData.sworn_declaration = swornDeclaration
    if (swornDeclarationText !== undefined) updateData.sworn_declaration_text = swornDeclarationText

    const { data: updatedDispute, error: updateError } = await supabase
      .from('disputes')
      .update(updateData)
      .eq('id', disputeId)
      .select()
      .single()

    if (updateError || !updatedDispute) {
      console.error('Update dispute error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update dispute', details: updateError?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      dispute: updatedDispute,
    })
  } catch (error: any) {
    console.error('Update dispute error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

