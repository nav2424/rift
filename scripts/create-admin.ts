import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function main() {
  console.log('🔐 Create Admin Account\n')

  const email = await question('Email: ')
  const name = await question('Name (optional): ')
  const password = await question('Password: ')

  if (!email || !password) {
    console.error('❌ Email and password are required!')
    process.exit(1)
  }

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
      } else {
        await prisma.user.update({
          where: { email },
          data: { role: 'ADMIN' },
        })
        console.log('✅ Existing user updated to admin!')
      }
      rl.close()
      return
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
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
  } finally {
    rl.close()
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })

