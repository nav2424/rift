import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import { generateInvoiceNumber } from '@/lib/invoice-number'

/**
 * Create a draft invoice for a Service-based Rift
 * POST /api/rifts/:riftId/invoice
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

    const { id: riftId } = await params

    // Verify rift exists and is a service type
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        itemType: true,
        sellerId: true,
        buyerId: true,
        subtotal: true,
        currency: true,
        itemTitle: true,
        buyer: {
          select: {
            email: true,
            name: true,
          },
        },
        seller: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Verify user is the seller
    if (rift.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify rift is a service type
    if (rift.itemType !== 'SERVICES') {
      return NextResponse.json(
        { error: 'Invoices can only be created for service-based rifts' },
        { status: 400 }
      )
    }

    // Check if invoice already exists for this rift
    const supabase = createServerClient()
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('rift_id', riftId)
      .maybeSingle()

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice already exists for this rift' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber()

    // Calculate totals
    const subtotal = rift.subtotal || 0
    const tax = 0 // Default to 0, can be updated later
    const total = subtotal + tax

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        rift_id: riftId,
        seller_id: rift.sellerId,
        buyer_email: rift.buyer.email,
        buyer_name: rift.buyer.name,
        invoice_number: invoiceNumber,
        status: 'draft',
        currency: rift.currency || 'USD',
        subtotal,
        tax,
        total,
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError)
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      )
    }

    // Create default invoice item from rift
    const { error: itemError } = await supabase
      .from('invoice_items')
      .insert({
        invoice_id: invoice.id,
        name: rift.itemTitle,
        description: null,
        quantity: 1,
        unit_price: subtotal,
        amount: subtotal,
      })

    if (itemError) {
      console.error('Error creating invoice item:', itemError)
      // Invoice was created but item failed - this is not critical, continue
    }

    // Fetch complete invoice with items
    const { data: completeInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .eq('id', invoice.id)
      .single()

    if (fetchError) {
      console.error('Error fetching invoice:', fetchError)
      return NextResponse.json(invoice, { status: 201 })
    }

    return NextResponse.json(completeInvoice, { status: 201 })
  } catch (error: any) {
    console.error('Create invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get invoice for a rift
 * GET /api/rifts/:riftId/invoice
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

    const { id: riftId } = await params

    // Verify rift exists
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        sellerId: true,
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Verify user is the seller
    if (rift.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch invoice with items
    const supabase = createServerClient()
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .eq('rift_id', riftId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }
      console.error('Error fetching invoice:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invoice' },
        { status: 500 }
      )
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
