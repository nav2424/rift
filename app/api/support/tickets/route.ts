import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { generateNextSupportTicketNumber } from '@/lib/support-ticket-number'
import { randomUUID } from 'crypto'
import { SupportTicketPriority, SupportTicketCategory } from '@prisma/client'

/**
 * GET /api/support/tickets
 * List support tickets (user sees their own, admin sees all)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const isAdmin = auth.userRole === 'ADMIN'

    const where: any = {}
    
    // Non-admins only see their own tickets
    if (!isAdmin) {
      where.userId = auth.userId
    }

    if (status) {
      where.status = status
    }

    if (category) {
      where.category = category
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            riftUserId: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        RiftTransaction: {
          select: {
            id: true,
            riftNumber: true,
            itemTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tickets })
  } catch (error: any) {
    console.error('Get tickets error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, category, priority, relatedRiftId, metadata } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    const priorityMap: Record<string, SupportTicketPriority> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    }

    const categoryMap: Record<string, SupportTicketCategory> = {
      TECHNICAL: 'TECHNICAL',
      ACCOUNT: 'ACCOUNT',
      PAYMENT: 'PAYMENT',
      DISPUTE: 'DISPUTE',
      GENERAL: 'GENERAL',
      technical: 'TECHNICAL',
      account: 'ACCOUNT',
      payment: 'PAYMENT',
      dispute: 'DISPUTE',
      general: 'GENERAL',
    }

    const ticketPriority = priorityMap[priority] || 'MEDIUM'
    const ticketCategory = categoryMap[category] || 'GENERAL'

    const ticketNumber = await generateNextSupportTicketNumber()

    const ticket = await prisma.supportTicket.create({
      data: {
        id: randomUUID(),
        ticketNumber,
        userId: auth.userId,
        title,
        description,
        status: 'OPEN',
        priority: ticketPriority,
        category: ticketCategory,
        relatedRiftId: relatedRiftId || null,
        metadata: metadata || null,
        conversationHistory: [{
          role: 'user',
          content: description,
          timestamp: new Date().toISOString(),
        }],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error: any) {
    console.error('Create ticket error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
