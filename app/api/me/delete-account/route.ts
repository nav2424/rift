import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/**
 * Delete user account and all related data
 * This performs a cascading delete for GDPR compliance
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.userId

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent admins from deleting themselves (optional safety check)
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin accounts cannot be deleted through this endpoint' },
        { status: 403 }
      )
    }

    // Check if user has active transactions
    const activeRifts = await prisma.riftTransaction.findFirst({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: {
          notIn: ['RELEASED', 'CANCELLED', 'CANCELED', 'REFUNDED'],
        },
      },
    })

    if (activeRifts) {
      return NextResponse.json(
        { 
          error: 'Cannot delete account with active transactions',
          message: 'Please complete or cancel all active transactions before deleting your account',
        },
        { status: 400 }
      )
    }

    // Check if user has pending balance
    const wallet = await prisma.walletAccount.findUnique({
      where: { userId },
      select: { availableBalance: true, pendingBalance: true },
    })

    if (wallet && (wallet.availableBalance > 0 || wallet.pendingBalance > 0)) {
      return NextResponse.json(
        {
          error: 'Cannot delete account with balance',
          message: 'Please withdraw all funds before deleting your account',
        },
        { status: 400 }
      )
    }

    // Delete user (cascading deletes will handle related data)
    // Prisma will automatically delete:
    // - WalletAccount (via onDelete: Cascade)
    // - WalletLedgerEntry (via walletAccountId)
    // - UserBadge (via userId)
    // - UserMilestone (via userId)
    // - Activity (via userId)
    // - Disputes (via userId relations)
    // - TimelineEvents (via actorId)
    // - Payouts (via userId)
    // - VerificationCodes (via userId)
    // - Blocks (via userId relations)
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ 
      success: true,
      message: 'Account deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

