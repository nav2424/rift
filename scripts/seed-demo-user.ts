import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

async function main() {
  const demoEmail = 'demo@trusthold.com'
  const demoPassword = 'demo123'
  const demoName = 'Demo User'

  // Check if demo user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  })

  if (existingUser) {
    console.log('Demo user already exists!')
    console.log('Email:', demoEmail)
    console.log('Password:', demoPassword)
    return
  }

  // Hash password
  const passwordHash = await bcrypt.hash(demoPassword, 10)

  // Create demo user
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: demoName,
      email: demoEmail,
      passwordHash,
      role: 'USER',
      updatedAt: new Date(),
    },
  })

  console.log('✅ Demo user created successfully!')
  console.log('Email:', demoEmail)
  console.log('Password:', demoPassword)
  console.log('User ID:', user.id)
}

main()
  .catch((e) => {
    console.error('Error creating demo user:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

