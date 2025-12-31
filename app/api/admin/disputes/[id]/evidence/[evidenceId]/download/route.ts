import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/disputes/[id]/evidence/[evidenceId]/download
 * Admin downloads/view evidence file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth || auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: disputeId, evidenceId } = await params

    // Get evidence from Supabase
    const supabase = createServerClient()
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
          { error: 'Failed to generate download URL', details: urlError?.message },
          { status: 500 }
        )
      }

      // Redirect to signed URL
      return NextResponse.redirect(urlData.signedUrl)
    }

    return NextResponse.json(
      { error: 'Evidence has no file or text content' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Download evidence error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

