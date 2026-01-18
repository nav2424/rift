import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLinkToken } from '@/lib/plaid'

/**
 * Create a Plaid Link token for bank account connection
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const linkToken = await createLinkToken(userId)

    if (!linkToken) {
      return NextResponse.json(
        { error: 'Plaid is not configured. Bank transfers are not available.' },
        { status: 503 }
      )
    }

    return NextResponse.json({ linkToken })
  } catch (error: any) {
    console.error('Create Plaid Link token error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create Link token' },
      { status: 500 }
    )
  }
}
