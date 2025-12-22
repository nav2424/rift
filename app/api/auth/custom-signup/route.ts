import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { capturePolicyAcceptance } from '@/lib/policy-acceptance'
import { extractRequestMetadata } from '@/lib/rift-events'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, confirmPassword } = body

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate Rift user ID
    const riftUserId = await generateNextRiftUserId()

    // Create user with Rift user ID
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
        role: 'USER',
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

    return NextResponse.json(
      { message: 'User created successfully', userId: user.id },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Signup error:', error)
    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error?.message || 'Internal server error'
      : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? error?.stack : undefined },
      { status: 500 }
    )
  }
}

