import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { getWalletBalance } from '@/lib/wallet'

/**
 * Get wallet balance and ledger
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wallet = await getWalletBalance(auth.userId)

    return NextResponse.json({
      wallet: wallet.wallet,
      ledgerEntries: wallet.ledgerEntries,
    })
  } catch (error: any) {
    console.error('Get wallet error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
