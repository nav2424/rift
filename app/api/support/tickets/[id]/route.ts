import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client'

/**
 * GET /api/support/tickets/[id]
 * Get a specific support ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
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
        resolvedBy: {
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
            status: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Non-admins can only view their own tickets
    const isAdmin = auth.userRole === 'ADMIN'
    if (!isAdmin && ticket.userId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ ticket })
  } catch (error: any) {
    console.error('Get ticket error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/support/tickets/[id]
 * Update a support ticket (users can add messages, admins can update status/assign/resolve)
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

    const { id } = await params
    const body = await request.json()
    const { message, status, priority, assignedToId, resolved } = body

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const isAdmin = auth.userRole === 'ADMIN'
    const isOwner = ticket.userId === auth.userId

    // Non-admins can only add messages to their own tickets
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: any = {}

    // Users can only add messages
    if (!isAdmin && message) {
      const conversationHistory = (ticket.conversationHistory as any[]) || []
      conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      })
      updateData.conversationHistory = conversationHistory
    }

    // Admins can update status, priority, assignment, and add messages
    if (isAdmin) {
      if (status) {
        updateData.status = status as SupportTicketStatus
      }

      if (priority) {
        updateData.priority = priority as SupportTicketPriority
      }

      if (assignedToId !== undefined) {
        updateData.assignedToId = assignedToId || null
      }

      if (resolved === true) {
        updateData.status = 'RESOLVED'
        updateData.resolvedById = auth.userId
        updateData.resolvedAt = new Date()
      }

      if (message) {
        const conversationHistory = (ticket.conversationHistory as any[]) || []
        conversationHistory.push({
          role: 'admin',
          content: message,
          timestamp: new Date().toISOString(),
          adminId: auth.userId,
        })
        updateData.conversationHistory = conversationHistory
      }

      // If status changed to IN_PROGRESS and no one assigned, assign to current admin
      if (status === 'IN_PROGRESS' && !ticket.assignedToId) {
        updateData.assignedToId = auth.userId
      }
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: updateData,
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
        resolvedBy: {
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
    })

    return NextResponse.json({ ticket: updatedTicket })
  } catch (error: any) {
    console.error('Update ticket error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
