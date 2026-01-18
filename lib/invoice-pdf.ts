/**
 * Invoice PDF generation using pdf-lib (no external font files required)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createServerClient } from './supabase'

/**
 * Generate PDF for an invoice using pdf-lib (no external font files required)
 * Returns a Buffer containing the PDF
 */
export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  const supabase = createServerClient()

  // Fetch invoice with items and seller info
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items (*)
    `)
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) {
    throw new Error('Invoice not found')
  }

  // Fetch seller info from Prisma
  const { prisma } = await import('./prisma')
  const seller = await prisma.user.findUnique({
    where: { id: invoice.seller_id },
    select: {
      name: true,
      email: true,
    },
  })

  // Helper function to format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount)
  }

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()
  
  // Embed standard fonts (no external files needed)
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Add a page (LETTER size: 612 x 792 points)
  const page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()
  
  const margin = 50
  let yPos = height - margin

  // Header
  page.drawText('Rift', {
    x: margin,
    y: yPos,
    size: 24,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('INVOICE', {
    x: width - margin - 100,
    y: yPos,
    size: 32,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })

  yPos -= 50

  // Invoice details (right side)
  const rightX = width - margin - 150
  page.drawText('Invoice Number:', {
    x: rightX,
    y: yPos,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  })
  page.drawText(invoice.invoice_number, {
    x: rightX,
    y: yPos - 15,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })

  if (invoice.issued_at) {
    page.drawText('Issue Date:', {
      x: rightX,
      y: yPos - 35,
      size: 10,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    })
    page.drawText(new Date(invoice.issued_at).toLocaleDateString(), {
      x: rightX,
      y: yPos - 50,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
  }

  if (invoice.due_date) {
    page.drawText('Due Date:', {
      x: rightX,
      y: yPos - 70,
      size: 10,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    })
    page.drawText(new Date(invoice.due_date).toLocaleDateString(), {
      x: rightX,
      y: yPos - 85,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
  }

  yPos -= 120

  // Seller info (left side)
  page.drawText('From:', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(seller?.name || 'Seller', {
    x: margin,
    y: yPos - 20,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(seller?.email || '', {
    x: margin,
    y: yPos - 40,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Buyer info (right side)
  page.drawText('Bill To:', {
    x: rightX,
    y: yPos,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(invoice.buyer_name || invoice.buyer_email, {
    x: rightX,
    y: yPos - 20,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(invoice.buyer_email, {
    x: rightX,
    y: yPos - 40,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  yPos -= 80

  // Table header
  const tableTop = yPos
  const rowHeight = 25
  const colWidths = [280, 80, 100, 100]
  const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]]

  // Draw header background
  page.drawRectangle({
    x: margin,
    y: tableTop - 20,
    width: width - 2 * margin,
    height: rowHeight,
    color: rgb(0.2, 0.2, 0.2),
  })

  // Header text
  page.drawText('Description', {
    x: colX[0] + 10,
    y: tableTop - 5,
    size: 10,
    font: helveticaBoldFont,
    color: rgb(1, 1, 1),
  })
  page.drawText('Quantity', {
    x: colX[1] + 10,
    y: tableTop - 5,
    size: 10,
    font: helveticaBoldFont,
    color: rgb(1, 1, 1),
  })
  page.drawText('Unit Price', {
    x: colX[2] + 10,
    y: tableTop - 5,
    size: 10,
    font: helveticaBoldFont,
    color: rgb(1, 1, 1),
  })
  page.drawText('Amount', {
    x: colX[3] + 10,
    y: tableTop - 5,
    size: 10,
    font: helveticaBoldFont,
    color: rgb(1, 1, 1),
  })

  // Table rows
  let currentY = tableTop - rowHeight - 10

  if (invoice.invoice_items && invoice.invoice_items.length > 0) {
    invoice.invoice_items.forEach((item: any, index: number) => {
      // Alternate row colors
      if (index % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight + 5,
          width: width - 2 * margin,
          height: rowHeight,
          color: rgb(0.96, 0.96, 0.96),
        })
      }

      page.drawText(item.name || '', {
        x: colX[0] + 10,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
        maxWidth: colWidths[0] - 20,
      })
      page.drawText(item.quantity?.toString() || '1', {
        x: colX[1] + 10,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      })
      page.drawText(formatCurrency(item.unit_price || 0, invoice.currency), {
        x: colX[2] + 10,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      })
      page.drawText(formatCurrency(item.amount || 0, invoice.currency), {
        x: colX[3] + 10,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      })

      currentY -= rowHeight
    })
  }

  // Totals section
  const totalsY = currentY - 20
  const totalsRightX = width - margin - 100

  page.drawText('Subtotal:', {
    x: totalsRightX - 80,
    y: totalsY,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(formatCurrency(invoice.subtotal || 0, invoice.currency), {
    x: totalsRightX,
    y: totalsY,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })

  if (invoice.tax && invoice.tax > 0) {
    page.drawText('Tax:', {
      x: totalsRightX - 80,
      y: totalsY - 20,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
    page.drawText(formatCurrency(invoice.tax, invoice.currency), {
      x: totalsRightX,
      y: totalsY - 20,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
  }

  page.drawText('Total:', {
    x: totalsRightX - 80,
    y: totalsY - 50,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(formatCurrency(invoice.total || 0, invoice.currency), {
    x: totalsRightX,
    y: totalsY - 50,
    size: 12,
    font: helveticaBoldFont,
    color: rgb(0, 0, 0),
  })

  // Notes
  if (invoice.notes) {
    page.drawText('Notes:', {
      x: margin,
      y: totalsY - 100,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
    page.drawText(invoice.notes, {
      x: margin,
      y: totalsY - 120,
      size: 10,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
      maxWidth: width - 2 * margin,
    })
  }

  // Footer
  page.drawText('Thank you for your business!', {
    x: width / 2 - 100,
    y: margin + 20,
    size: 8,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6),
  })
  page.drawText('Powered by Rift', {
    x: width / 2 - 50,
    y: margin + 5,
    size: 8,
    font: helveticaFont,
    color: rgb(0.6, 0.6, 0.6),
  })

  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Upload PDF to Supabase storage
 */
export async function uploadInvoicePDF(
  invoiceId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const supabase = createServerClient()
  const fileName = `invoice-${invoiceId}.pdf`

  // Upload to invoices bucket
  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) {
    // If bucket doesn't exist, try creating it or use a different approach
    console.error('Error uploading PDF:', error)
    throw new Error('Failed to upload PDF')
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('invoices')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}
