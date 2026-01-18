import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'

/**
 * Update an invoice (draft or sent status only)
 * PATCH /api/invoices/:invoiceId
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await params
    const body = await request.json()

    const supabase = createServerClient()

    // Fetch existing invoice to verify ownership and status
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify user is the seller
    if (invoice.seller_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow updates if status is draft or sent
    if (!['draft', 'sent'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Can only update invoices in draft or sent status' },
        { status: 400 }
      )
    }

    // Calculate totals from items if items are provided
    let subtotal = invoice.subtotal
    let total = invoice.total

    if (body.items) {
      // Recalculate subtotal from items
      subtotal = body.items.reduce((sum: number, item: any) => {
        const itemAmount = (item.quantity || 1) * (item.unit_price || 0)
        return sum + itemAmount
      }, 0)

      const tax = body.tax !== undefined ? body.tax : invoice.tax
      total = subtotal + tax
    } else if (body.tax !== undefined) {
      // Update tax and recalculate total
      total = subtotal + body.tax
    }

    // Prepare update data
    const updateData: any = {}
    if (body.buyer_name !== undefined) updateData.buyer_name = body.buyer_name
    if (body.buyer_email !== undefined) updateData.buyer_email = body.buyer_email
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.tax !== undefined) updateData.tax = body.tax
    updateData.subtotal = subtotal
    updateData.total = total

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating invoice:', updateError)
      return NextResponse.json(
        { error: 'Failed to update invoice' },
        { status: 500 }
      )
    }

    // Update items if provided
    if (body.items) {
      // Delete existing items
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId)

      // Insert new items
      const itemsToInsert = body.items.map((item: any) => ({
        invoice_id: invoiceId,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        amount: (item.quantity || 1) * (item.unit_price || 0),
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error updating invoice items:', itemsError)
        // Continue even if items update fails
      }
    }

    // Fetch complete invoice with items
    const { data: completeInvoice, error: fetchCompleteError } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .eq('id', invoiceId)
      .single()

    if (fetchCompleteError) {
      return NextResponse.json(updatedInvoice, { status: 200 })
    }

    return NextResponse.json(completeInvoice)
  } catch (error: any) {
    console.error('Update invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get invoice by ID
 * GET /api/invoices/:invoiceId
 */
export async function GET(
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

    // Verify user is the seller
    if (invoice.seller_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error('Get invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
