/**
 * Admin Login Endpoint
 * Handles admin authentication with MFA
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminCredentials, createAdminSession, hashIp } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { AdminAuditAction } from '@prisma/client'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, totpCode } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Verify credentials
    const result = await verifyAdminCredentials(email, password, totpCode)

    if (!result.success || !result.adminUser) {
      // Log failed login attempt
      await logAdminAction({
        adminUserId: result.adminUser?.id || 'unknown',
        action: 'LOGIN_FAILED',
        reasonCode: 'INVALID_CREDENTIALS',
        ip,
        userAgent,
        notes: `Failed login attempt for ${email}`,
      })

      return NextResponse.json(
        { error: result.error || 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create session
    const sessionToken = await createAdminSession(
      result.adminUser.id,
      ip,
      userAgent
    )

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: result.adminUser.sessionDurationHours * 3600,
      path: '/',
    })

    // Log successful login
    await logAdminAction({
      adminUserId: result.adminUser.id,
      action: 'LOGIN_SUCCESS',
      ip,
      userAgent,
      sessionId: sessionToken,
      notes: result.adminUser.isBreakGlass ? 'BREAK-GLASS ACCESS' : undefined,
    })

    return NextResponse.json({
      success: true,
      requiresMfa: result.adminUser.mfaEnabled && !totpCode,
      isBreakGlass: result.adminUser.isBreakGlass,
    })
  } catch (error: any) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value

    if (sessionToken) {
      // Get session to log logout
      const { prisma } = await import('@/lib/prisma')
      const session = await prisma.admin_sessions.findUnique({
        where: { sessionToken },
      })

      if (session) {
        // Log logout
        await logAdminAction({
          adminUserId: session.adminUserId,
          action: 'LOGOUT',
          sessionId: session.id,
        })

        // Invalidate session
        await prisma.admin_sessions.update({
          where: { id: session.id },
          data: { isActive: false },
        })
      }
    }

    cookieStore.delete('admin_session')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin logout error:', error)
    return NextResponse.json(
      { error: error.message || 'Logout failed' },
      { status: 500 }
    )
  }
}

