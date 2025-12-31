import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { ensureRiftUserId } from '@/lib/rift-user-id'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user has a Rift ID (assigns one if missing)
    let riftUserId: string | null = null
    try {
      riftUserId = await ensureRiftUserId(auth.userId)
    } catch (error) {
      console.error('Error ensuring Rift ID:', error)
      // Continue anyway - we'll still return user data
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        idVerified: true,
        bankVerified: true,
        riftUserId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If ensureRiftUserId returned a Rift ID but user object doesn't have it, use the returned value
    // This handles race conditions where the ID was just assigned
    const finalRiftUserId = user.riftUserId || riftUserId

    // If user still doesn't have a Rift ID after ensureRiftUserId, log it
    if (!finalRiftUserId) {
      console.warn(`User ${user.id} (${user.email}) does not have a Rift ID after ensureRiftUserId call`)
    }

    return NextResponse.json({
      ...user,
      riftUserId: finalRiftUserId || user.riftUserId,
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

