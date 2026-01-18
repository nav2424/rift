import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exchangePublicToken } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'

/**
 * Exchange Plaid public token for access token
 * Stores the access token in the user's profile
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { publicToken } = body

    if (!publicToken) {
      return NextResponse.json(
        { error: 'Public token is required' },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // Exchange public token for access token
    const result = await exchangePublicToken(publicToken, userId)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to exchange public token' },
        { status: 500 }
      )
    }

    // Note: With Stripe's built-in Plaid integration via us_bank_account,
    // we don't need to store the Plaid access token separately.
    // Stripe handles the Plaid connection through their Payment Intents API.
    // If you need to store Plaid data for future use, you would add
    // plaidAccessToken and plaidItemId fields to the User model.

    return NextResponse.json({
      success: true,
      itemId: result.itemId,
    })
  } catch (error: any) {
    console.error('Exchange Plaid token error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to exchange token' },
      { status: 500 }
    )
  }
}
