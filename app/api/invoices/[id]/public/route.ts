import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { verifyInvoiceToken } from '@/lib/invoice-token'

/**
 * Get invoice by ID (public access with token)
 * GET /api/invoices/:invoiceId/public?token=...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify token
    const verifiedInvoiceId = verifyInvoiceToken(token)
    if (!verifiedInvoiceId || verifiedInvoiceId !== invoiceId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const supabase = createServerClient()

    // Fetch invoice with items
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .eq('id', invoiceId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Don't expose sensitive fields to public view
    const publicInvoice = {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      due_date: invoice.due_date,
      issued_at: invoice.issued_at,
      sent_at: invoice.sent_at,
      paid_at: invoice.paid_at,
      buyer_name: invoice.buyer_name,
      buyer_email: invoice.buyer_email,
      notes: invoice.notes,
      payment_url: invoice.payment_url,
      pdf_url: invoice.pdf_url,
      invoice_items: invoice.invoice_items || [],
    }

    return NextResponse.json(publicInvoice)
  } catch (error: any) {
    console.error('Get public invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
