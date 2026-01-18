import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateNextRiftUserId } from '@/lib/rift-user-id'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      const secret = process.env.SEED_DEMO_SECRET
      const provided = request.headers.get('x-seed-secret')
      if (!secret || provided !== secret) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    }

    const body = await request.json().catch(() => ({}))
    const demoEmail = body.email || 'demo@rift.com'
    const demoPassword = body.password || 'demo123'
    const demoName = body.name || 'Demo User'
    const demoPhone = body.phone || null

    // Check if demo user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: demoEmail },
    })

    if (existingUser) {
      await prisma.user.update({
        where: { email: demoEmail },
        data: {
          name: demoName,
          phone: demoPhone,
          passwordHash: await bcrypt.hash(demoPassword, 10),
          emailVerified: true,
          phoneVerified: true,
          idVerified: true,
          bankVerified: true,
          stripeIdentityVerified: true,
          updatedAt: new Date(),
        },
      })
      return NextResponse.json({
        message: 'Demo user updated',
        email: demoEmail,
        password: demoPassword,
        phone: demoPhone,
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(demoPassword, 10)

    // Generate Rift user ID
    const riftUserId = await generateNextRiftUserId()

    // Create demo user
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: demoName,
        email: demoEmail,
        phone: demoPhone,
        passwordHash,
        role: 'USER',
        riftUserId,
        emailVerified: true,
        phoneVerified: true,
        idVerified: true,
        bankVerified: true,
        stripeIdentityVerified: true,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Demo user created successfully',
      email: demoEmail,
      password: demoPassword,
      phone: demoPhone,
      userId: user.id,
    })
  } catch (error) {
    console.error('Error creating demo User:', error)
    return NextResponse.json(
      { error: 'Failed to create demo user' },
      { status: 500 }
    )
  }
}

