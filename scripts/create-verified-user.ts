import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { generateNextRiftUserId } from '@/lib/rift-user-id'

const email = process.env.TEST_USER_EMAIL || `verified-test-${Date.now()}@rift.com`
const password = process.env.TEST_USER_PASSWORD || 'RiftTest123!'
const name = process.env.TEST_USER_NAME || 'Verified Test User'
const phone = process.env.TEST_USER_PHONE || `+1555${Math.floor(1000000 + Math.random() * 8999999)}`

async function main() {
  const passwordHash = await bcrypt.hash(password, 10)
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        name,
        phone,
        passwordHash,
        idVerified: true,
        bankVerified: true,
        emailVerified: true,
        phoneVerified: true,
        stripeIdentityVerified: true,
        updatedAt: new Date(),
      },
    })

    console.log('Updated existing user to fully verified.')
  } else {
    const riftUserId = await generateNextRiftUserId()
    await prisma.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        phone,
        passwordHash,
        role: 'USER',
        riftUserId,
        idVerified: true,
        bankVerified: true,
        emailVerified: true,
        phoneVerified: true,
        stripeIdentityVerified: true,
        updatedAt: new Date(),
      },
    })

    console.log('Created fully verified user.')
  }

  console.log('Credentials:')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log(`Phone: ${phone}`)
}

main()
  .catch((error) => {
    console.error('Failed to create verified user:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
