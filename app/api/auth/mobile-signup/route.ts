import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { capturePolicyAcceptance } from '@/lib/policy-acceptance'
import { extractRequestMetadata } from '@/lib/rift-events'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-make-sure-to-change-this'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Same validation as website signup
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if user exists - same as website
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password - same method as website
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate Rift user ID
    const riftUserId = await generateNextRiftUserId()

    // Create user - same as website
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: 'USER', // Explicitly set role like website does
        riftUserId,
      },
    })

    // Capture policy acceptance at signup
    try {
      const requestMeta = extractRequestMetadata(request)
      await capturePolicyAcceptance(user.id, 'signup', requestMeta)
    } catch (error) {
      console.error('Error capturing policy acceptance:', error)
      // Don't fail signup if policy acceptance fails
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    })
  } catch (error) {
    console.error('Mobile sign up error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

