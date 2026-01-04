/**
 * Seed Admin Roles and Permissions
 * Run this to initialize the admin RBAC system
 */

import { prisma } from '../lib/prisma'
import { AdminRole, AdminPermission } from '@prisma/client'

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    // All permissions
    ...Object.values(AdminPermission),
  ],
  RISK_ADMIN: [
    AdminPermission.USER_READ,
    AdminPermission.USER_FREEZE,
    AdminPermission.USER_BAN,
    AdminPermission.USER_RESTRICT,
    AdminPermission.RIFT_READ,
    AdminPermission.RIFT_FORCE_UNDER_REVIEW,
    AdminPermission.RIFT_ESCALATE,
    AdminPermission.DISPUTE_READ,
    AdminPermission.DISPUTE_RESOLVE,
    AdminPermission.RISK_READ,
    AdminPermission.RISK_UPDATE_SCORE,
    AdminPermission.RISK_AUTO_HOLD,
    AdminPermission.PAYOUT_READ,
    AdminPermission.PAYOUT_HOLD,
    AdminPermission.VAULT_READ,
    AdminPermission.VAULT_VIEW_METADATA,
    AdminPermission.AUDIT_READ,
  ],
  SUPPORT_ADMIN: [
    AdminPermission.USER_READ,
    AdminPermission.RIFT_READ,
    AdminPermission.DISPUTE_READ,
    AdminPermission.DISPUTE_REQUEST_INFO,
    AdminPermission.VAULT_READ,
    AdminPermission.VAULT_VIEW_METADATA,
    AdminPermission.AUDIT_READ,
  ],
  OPS_ADMIN: [
    AdminPermission.RIFT_READ,
    AdminPermission.PAYOUT_READ,
    AdminPermission.PAYOUT_SCHEDULE,
    AdminPermission.PAYOUT_PAUSE,
    AdminPermission.VAULT_READ,
    AdminPermission.VAULT_VIEW_METADATA,
    AdminPermission.AUDIT_READ,
  ],
  DEV_ADMIN: [
    AdminPermission.USER_READ,
    AdminPermission.RIFT_READ,
    AdminPermission.VAULT_READ,
    AdminPermission.VAULT_VIEW_METADATA,
    AdminPermission.FEATURE_FLAG_READ,
    AdminPermission.FEATURE_FLAG_UPDATE,
    AdminPermission.AUDIT_READ,
  ],
}

async function seedAdminRoles() {
  console.log('Seeding admin roles and permissions...')

  // Create all permissions
  for (const permission of Object.values(AdminPermission)) {
    await prisma.admin_permissions.upsert({
      where: { name: permission },
      create: {
        id: crypto.randomUUID(),
        name: permission,
        description: `Permission: ${permission}`,
      },
      update: {},
    })
  }

  console.log('✅ Created all permissions')

  // Create roles with permissions
  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.admin_roles.upsert({
      where: { name: roleName as AdminRole },
      create: {
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        name: roleName as AdminRole,
        description: `${roleName} role`,
      },
      update: {},
    })

    // Assign permissions to role
    for (const permission of permissions) {
      const perm = await prisma.admin_permissions.findUnique({
        where: { name: permission },
      })

      if (perm) {
        await prisma.admin_role_permissions.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          create: {
            id: crypto.randomUUID(),
            roleId: role.id,
            permissionId: perm.id,
          },
          update: {},
        })
      }
    }

    console.log(`✅ Created role ${roleName} with ${permissions.length} permissions`)
  }

  console.log('✅ Admin roles and permissions seeded successfully')
}

seedAdminRoles()
  .catch((error) => {
    console.error('Error seeding admin roles:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

