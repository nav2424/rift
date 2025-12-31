/**
 * Admin Rift Actions
 * Force under review, approve, reject, escalate, cancel
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, requirePermission } from '@/lib/admin-auth'
import { AdminPermission } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { transitionRiftState } from '@/lib/rift-state'
import { AdminAuditAction } from '@prisma/client'

/**
 * POST /api/admin/rifts/[riftId]/actions
 * Perform admin action on rift
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const session = await requireAdminAuth(request)
    const { riftId } = await params
    const body = await request.json()
    const { action, reasonCode, notes, reAuthPassword } = body

    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    const beforeState = {
      id: rift.id,
      status: rift.status,
    }

    let auditAction: AdminAuditAction
    let newStatus: string
    let requiredPermission: AdminPermission

    // Handle different actions
    switch (action) {
      case 'FORCE_UNDER_REVIEW':
        requiredPermission = AdminPermission.RIFT_FORCE_UNDER_REVIEW
        auditAction = 'RIFT_FORCE_UNDER_REVIEW'
        newStatus = 'UNDER_REVIEW'
        break

      case 'APPROVE':
        requiredPermission = AdminPermission.RIFT_APPROVE
        auditAction = 'RIFT_APPROVED'
        newStatus = 'RELEASED'
        break

      case 'REJECT':
        requiredPermission = AdminPermission.RIFT_REJECT
        auditAction = 'RIFT_REJECTED'
        newStatus = 'PROOF_SUBMITTED'
        break

      case 'ESCALATE':
        requiredPermission = AdminPermission.RIFT_ESCALATE
        auditAction = 'RIFT_ESCALATED'
        newStatus = 'DISPUTED'
        break

      case 'CANCEL':
        requiredPermission = AdminPermission.RIFT_CANCEL
        auditAction = 'RIFT_CANCELED'
        newStatus = 'CANCELED'
        // Require re-auth for cancel
        if (!reAuthPassword) {
          return NextResponse.json(
            { error: 'Re-authentication required for cancel action' },
            { status: 403 }
          )
        }
        const { requireReAuth } = await import('@/lib/admin-auth')
        const reAuthValid = await requireReAuth(session, reAuthPassword)
        if (!reAuthValid) {
          return NextResponse.json(
            { error: 'Re-authentication failed' },
            { status: 403 }
          )
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Check permission
    requirePermission(session, requiredPermission)

    // Perform state transition
    await transitionRiftState(riftId, newStatus as any, {
      userId: session.adminUserId,
      reason: notes || reasonCode,
    })

    const afterState = {
      id: rift.id,
      status: newStatus,
    }

    // Log action
    await logAdminAction({
      adminUserId: session.adminUserId,
      action: auditAction,
      objectType: 'rift',
      objectId: riftId,
      beforeState,
      afterState,
      reasonCode: reasonCode || 'ADMIN_DECISION',
      notes,
    })

    return NextResponse.json({
      success: true,
      newStatus,
    })
  } catch (error: any) {
    console.error('Admin rift action error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform action' },
      { status: 500 }
    )
  }
}

