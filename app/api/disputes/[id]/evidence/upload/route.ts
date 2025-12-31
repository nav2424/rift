import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/disputes/[id]/evidence/upload
 * Upload evidence file to storage and create evidence record
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'File size exceeds limit',
          message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 10MB`,
          maxSize: MAX_FILE_SIZE,
          fileSize: file.size,
        },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['image', 'pdf', 'file']
    const fileType = type || (file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file')
    
    if (!validTypes.includes(fileType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

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
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if evidence can be added
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

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${disputeId}/${userId}/${Date.now()}.${fileExt}`
    const storagePath = `dispute-evidence/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('dispute-evidence')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    // Determine uploader role
    const uploaderRole = isBuyer ? 'buyer' : isSeller ? 'seller' : 'admin'

    // Create evidence record
    const { data: evidence, error: evidenceError } = await supabase
      .from('dispute_evidence')
      .insert({
        dispute_id: disputeId,
        uploader_id: userId,
        uploader_role: uploaderRole,
        type: fileType,
        storage_path: storagePath,
        meta: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      })
      .select()
      .single()

    if (evidenceError || !evidence) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from('dispute-evidence').remove([storagePath])
      console.error('Create evidence error:', evidenceError)
      return NextResponse.json(
        { error: 'Failed to create evidence record', details: evidenceError?.message },
        { status: 500 }
      )
    }

    // Create dispute action
    await supabase.from('dispute_actions').insert({
      dispute_id: disputeId,
      actor_id: userId,
      actor_role: uploaderRole,
      action_type: 'evidence_added',
      note: `Added ${fileType} evidence: ${file.name}`,
      meta: { evidenceId: evidence.id },
    })

    return NextResponse.json({
      success: true,
      evidence: {
        id: evidence.id,
        type: evidence.type,
        storagePath: evidence.storage_path,
      },
    })
  } catch (error: any) {
    console.error('Upload evidence error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

