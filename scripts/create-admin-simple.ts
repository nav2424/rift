import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

// Usage: tsx scripts/create-admin-simple.ts <email> <password> [name]
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: npm run create:admin:simple <email> <password> [name]')
    console.log('Example: npm run create:admin:simple admin@rift.com mypassword123 "Admin User"')
    process.exit(1)
  }

  const email = args[0]
  const password = args[1]
  const name = args[2] || null

  if (password.length < 6) {
    console.error('❌ Password must be at least 6 characters!')
    process.exit(1)
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // Update existing user to admin
      if (existingUser.role === 'ADMIN') {
        console.log('✅ User already exists and is already an admin!')
        console.log(`   Email: ${existingUser.email}`)
      } else {
        await prisma.user.update({
          where: { email },
          data: { role: 'ADMIN' },
        })
        console.log('✅ Existing user updated to admin!')
        console.log(`   Email: ${existingUser.email}`)
      }
      return
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'ADMIN',
      },
    })

    console.log('\n✅ Admin account created successfully!')
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name || 'Not set'}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   User ID: ${user.id}`)
  } catch (error) {
    console.error('❌ Error creating admin account:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

