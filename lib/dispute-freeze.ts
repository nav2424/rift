/**
 * Dispute Freeze Enforcement
 * 
 * Checks if a rift has active disputes and prevents releases.
 */

import { prisma } from './prisma'
import { createServerClient } from './supabase'

export interface DisputeFreezeCheck {
  frozen: boolean
  reason?: string
  activeDisputes?: Array<{
    id: string
    type: 'internal' | 'stripe'
    status: string
  }>
}

/**
 * Check if a rift is frozen due to disputes
 */
export async function checkDisputeFreeze(riftId: string): Promise<DisputeFreezeCheck> {
  const activeDisputes: DisputeFreezeCheck['activeDisputes'] = []

  // Check Prisma Dispute table for active disputes
  try {
    const prismaDisputes = await prisma.dispute.findMany({
      where: {
        escrowId: riftId,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
      select: { id: true, status: true },
    })

    if (prismaDisputes.length > 0) {
      activeDisputes.push(
        ...prismaDisputes.map((d) => ({
          id: d.id,
          type: 'internal' as const,
          status: d.status,
        }))
      )
    }
  } catch (error) {
    // Prisma check failed, continue with other checks
  }

  // Check Supabase for internal disputes
  try {
    const supabase = createServerClient()
    if (supabase) {
      const { data: internalDisputes } = await supabase
        .from('disputes')
        .select('id, status')
        .eq('rift_id', riftId)
        .in('status', ['submitted', 'needs_info', 'under_review', 'open'])

      if (internalDisputes && internalDisputes.length > 0) {
        activeDisputes.push(
          ...internalDisputes.map((d: any) => ({
            id: d.id,
            type: 'internal' as const,
            status: d.status,
          }))
        )
      }

      // Check for Stripe disputes
      const { data: stripeDisputes } = await supabase
        .from('stripe_disputes')
        .select('stripe_dispute_id, status')
        .eq('rift_id', riftId)
        .in('status', ['needs_response', 'warning_needs_response', 'under_review'])

      if (stripeDisputes && stripeDisputes.length > 0) {
        activeDisputes.push(
          ...stripeDisputes.map((d: any) => ({
            id: d.stripe_dispute_id,
            type: 'stripe' as const,
            status: d.status,
          }))
        )
      }
    }
  } catch (error) {
    // Supabase check failed, continue with Prisma-based checks
  }

  if (activeDisputes.length > 0) {
    return {
      frozen: true,
      reason: `Active ${activeDisputes.length} dispute(s) - releases are frozen until resolved`,
      activeDisputes,
    }
  }

  // Also check if rift status is DISPUTED
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: { status: true },
  })

  if (rift?.status === 'DISPUTED') {
    return {
      frozen: true,
      reason: 'Rift is in DISPUTED status - releases are frozen',
    }
  }

  return {
    frozen: false,
  }
}




