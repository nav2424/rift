import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { getWalletBalance } from '@/lib/wallet'
import { parsePaginationParams, createPaginatedResponse } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'

/**
 * Get wallet balance and ledger
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { page, limit, skip } = parsePaginationParams(request)
    const walletData = await getWalletBalance(auth.userId)

    // Get paginated ledger entries
    const walletAccount = await prisma.walletAccount.findUnique({
      where: { userId: auth.userId },
    })

    if (!walletAccount) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const total = await prisma.walletLedgerEntry.count({
      where: { walletAccountId: walletAccount.id },
    })

    const ledgerEntries = await prisma.walletLedgerEntry.findMany({
      where: { walletAccountId: walletAccount.id },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      wallet: walletData.wallet,
      ledgerEntries: ledgerEntries,
      pagination: createPaginatedResponse(ledgerEntries, page, limit, total).pagination,
    })
  } catch (error: any) {
    console.error('Get wallet error:', error)
    
    // If user doesn't exist in database, return 401 to force re-authentication
    if (error.message?.includes('User not found') || error.message?.includes('Cannot create wallet account for non-existent user')) {
      return NextResponse.json(
        { error: 'Session invalid. Please sign in again.' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
