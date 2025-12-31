/**
 * Get current admin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Return session info (without sensitive data)
    return NextResponse.json({
      adminUserId: session.adminUserId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      permissions: session.permissions,
      isBreakGlass: session.isBreakGlass,
    })
  } catch (error: any) {
    console.error('Get session error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get session' },
      { status: 500 }
    )
  }
}

