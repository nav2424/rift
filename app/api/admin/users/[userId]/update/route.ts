import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * Update user information (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin()
    const { userId } = await params
    const body = await request.json()

    const { name, email, phone, role } = body

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) {
      // Check if email is already in use by another user (only for completed signups)
      const existingUserByEmail = await prisma.user.findFirst({
        where: { 
          email,
          id: { not: userId },
        },
      })
      
      if (existingUserByEmail) {
        return NextResponse.json(
          { error: 'This email is already associated with another account' },
          { status: 400 }
        )
      }
      
      updateData.email = email
    }
    if (phone !== undefined) {
      // Validate phone number format if provided
      if (phone) {
        const { formatPhoneNumber, validatePhoneNumber } = await import('@/lib/sms')
        const validation = validatePhoneNumber(phone)
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error || 'Invalid phone number format' },
            { status: 400 }
          )
        }
        const { formatted: formattedPhone, error: formatError } = formatPhoneNumber(phone)
        if (formatError || !formattedPhone) {
          return NextResponse.json(
            { error: formatError || 'Failed to format phone number' },
            { status: 400 }
          )
        }
        
        // Check if phone number is already in use by another user (only for completed signups)
        const existingUserByPhone = await prisma.user.findFirst({
          where: {
            phone: formattedPhone,
            id: { not: userId }, // Exclude current user
          },
        })

        if (existingUserByPhone) {
          return NextResponse.json(
            { error: 'This phone number is already associated with another account' },
            { status: 400 }
          )
        }
        
        updateData.phone = formattedPhone
      } else {
        updateData.phone = null
      }
    }
    if (role !== undefined) {
      // Validate role
      if (!['USER', 'ADMIN'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be USER or ADMIN' },
          { status: 400 }
        )
      }
      updateData.role = role
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent changing the last admin's role
    if (user.role === 'ADMIN' && role === 'USER') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last admin user' },
          { status: 400 }
        )
      }
    }

    // If email is being changed, check for duplicates (only for completed signups)
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          email,
          id: { not: userId },
        },
      })
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        )
      }
    }

    // Update user with error handling for unique constraints
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json(updatedUser)
    } catch (updateError: any) {
      // Handle Prisma unique constraint violation
      if (updateError.code === 'P2002') {
        const target = updateError.meta?.target || []
        if (Array.isArray(target)) {
          if (target.includes('email')) {
            return NextResponse.json(
              { error: 'This email is already associated with another account' },
              { status: 400 }
            )
          }
          if (target.includes('phone')) {
            return NextResponse.json(
              { error: 'This phone number is already associated with another account' },
              { status: 400 }
            )
          }
        }
        // Generic unique constraint error
        return NextResponse.json(
          { error: 'A user with this information already exists' },
          { status: 400 }
        )
      }
      // Re-throw if it's a different error
      throw updateError
    }
  } catch (error: any) {
    console.error('Update user error:', error)
    
    // Handle redirect from requireAdmin
    if (error.message?.includes('redirect')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

