import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { generateInvoicePDF, uploadInvoicePDF } from '@/lib/invoice-pdf'

/**
 * Generate and upload PDF for an invoice
 * POST /api/invoices/:invoiceId/pdf
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await params

    const supabase = createServerClient()

    // Fetch invoice to verify ownership
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('seller_id, pdf_url')
      .eq('id', invoiceId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify user is the seller
    if (invoice.seller_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceId)

    // Upload to Supabase storage
    const pdfUrl = await uploadInvoicePDF(invoiceId, pdfBuffer)

    // Update invoice with PDF URL
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ pdf_url: pdfUrl })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice PDF URL:', updateError)
      // Continue even if update fails - PDF was generated
    }

    return NextResponse.json({ pdf_url: pdfUrl })
  } catch (error: any) {
    console.error('Generate PDF error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
