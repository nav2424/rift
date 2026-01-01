/**
 * Create AdminUser account for admin console
 * This is separate from regular User accounts
 */

import { prisma } from '../lib/prisma'
import { hash } from 'bcryptjs'

// Usage: tsx scripts/create-admin-user.ts <email> <password> [name] [role]
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: tsx scripts/create-admin-user.ts <email> <password> [name] [role]')
    console.log('Example: tsx scripts/create-admin-user.ts admin@rift.com mypassword123 "Admin User" SUPER_ADMIN')
    console.log('\nAvailable roles: SUPER_ADMIN, RISK_ADMIN, SUPPORT_ADMIN, OPS_ADMIN, DEV_ADMIN')
    process.exit(1)
  }

  const email = args[0]
  const password = args[1]
  const name = args[2] || 'Admin User'
  const roleName = (args[3] || 'SUPER_ADMIN') as any

  if (password.length < 6) {
    console.error('❌ Password must be at least 6 characters!')
    process.exit(1)
  }

  try {
    // Check if AdminUser already exists
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email },
    })

    if (existingAdmin) {
      console.log('✅ AdminUser already exists!')
      console.log(`   Email: ${existingAdmin.email}`)
      console.log(`   Name: ${existingAdmin.name}`)
      console.log(`   Active: ${existingAdmin.isActive}`)
      
      // Check roles
      const userRoles = await prisma.adminUserRole.findMany({
        where: { userId: existingAdmin.id },
        include: { role: true },
      })
      
      if (userRoles.length > 0) {
        console.log(`   Roles: ${userRoles.map(ur => ur.role.name).join(', ')}`)
      } else {
        console.log('   ⚠️  No roles assigned!')
      }
      
      return
    }

    // Hash password
    const passwordHash = await hash(password, 10)

    // Create AdminUser
    const adminUser = await prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash,
        isActive: true,
      },
    })

    console.log('✅ AdminUser created successfully!')
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Name: ${adminUser.name}`)
    console.log(`   ID: ${adminUser.id}`)

    // Find or create the role
    let role = await prisma.adminRoleModel.findUnique({
      where: { name: roleName },
    })

    if (!role) {
      console.log(`\n⚠️  Role '${roleName}' not found.`)
      console.log('   Please run: npx tsx scripts/seed-admin-roles.ts first')
      console.log('   Then run this script again.')
      process.exit(1)
    }

    // Assign role to admin user
    await prisma.adminUserRole.create({
      data: {
        userId: adminUser.id,
        roleId: role.id,
      },
    })

    console.log(`✅ Assigned role '${roleName}' to admin user`)

    // Show permissions
    const rolePermissions = await prisma.adminRolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    })

    if (rolePermissions.length > 0) {
      console.log(`\n📋 Permissions for ${roleName}:`)
      rolePermissions.forEach(rp => {
        console.log(`   - ${rp.permission.name}`)
      })
    }

    console.log('\n🎉 Setup complete!')
    console.log('\nNext steps:')
    console.log('1. Log in at /admin/auth/login (or your admin login page)')
    console.log(`2. Use email: ${email}`)
    console.log(`3. Use password: ${password}`)
    console.log('\n⚠️  Remember to change the password after first login!')

  } catch (error: any) {
    console.error('❌ Error creating AdminUser:', error)
    if (error.code === 'P2002') {
      console.error('   Email already exists in AdminUser table')
    }
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

