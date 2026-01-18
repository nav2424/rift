import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { generateInvoicePDF, uploadInvoicePDF } from '@/lib/invoice-pdf'
import { sendInvoiceEmail } from '@/lib/invoice-email'

/**
 * Send invoice email to buyer
 * POST /api/invoices/:invoiceId/send
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

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify user is the seller
    if (invoice.seller_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify invoice has buyer email
    if (!invoice.buyer_email) {
      return NextResponse.json(
        { error: 'Invoice must have a buyer email' },
        { status: 400 }
      )
    }

    // Generate PDF if it doesn't exist
    let pdfUrl = invoice.pdf_url
    if (!pdfUrl) {
      try {
        const pdfBuffer = await generateInvoicePDF(invoiceId)
        pdfUrl = await uploadInvoicePDF(invoiceId, pdfBuffer)

        // Update invoice with PDF URL
        await supabase
          .from('invoices')
          .update({ pdf_url: pdfUrl })
          .eq('id', invoiceId)
      } catch (pdfError: any) {
        console.error('Error generating PDF:', pdfError)
        // Continue even if PDF generation fails
      }
    }

    // Fetch seller info
    const seller = await prisma.user.findUnique({
      where: { id: invoice.seller_id },
      select: {
        name: true,
        email: true,
      },
    })

    // Send email
    const emailSent = await sendInvoiceEmail(
      invoiceId,
      invoice.invoice_number,
      invoice.buyer_email,
      invoice.buyer_name,
      seller?.name || null,
      invoice.total,
      invoice.currency,
      invoice.due_date,
      pdfUrl,
      invoice.payment_url || null
    )

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send email. Please check your email configuration.' },
        { status: 500 }
      )
    }

    // Update invoice status to sent
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        issued_at: invoice.issued_at || now,
        sent_at: now,
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice status:', updateError)
      // Continue even if update fails - email was sent
    }

    return NextResponse.json({ success: true, message: 'Invoice sent successfully' })
  } catch (error: any) {
    console.error('Send invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    )
  }
}
