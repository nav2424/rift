import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    const demoEmail = 'demo@rift.com'
    const demoPassword = 'demo123'
    const demoName = 'Demo User'

    // Check if demo user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: demoEmail },
    })

    if (existingUser) {
      return NextResponse.json({
        message: 'Demo user already exists',
        email: demoEmail,
        password: demoPassword,
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(demoPassword, 10)

    // Create demo user
    const user = await prisma.user.create({
      data: {
        name: demoName,
        email: demoEmail,
        passwordHash,
        role: 'USER',
      },
    })

    return NextResponse.json({
      message: 'Demo user created successfully',
      email: demoEmail,
      password: demoPassword,
      userId: user.id,
    })
  } catch (error) {
    console.error('Error creating demo user:', error)
    return NextResponse.json(
      { error: 'Failed to create demo user' },
      { status: 500 }
    )
  }
}

