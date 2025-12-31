-- Add Admin System: RBAC, Audit Logs, Sessions
-- Comprehensive admin console with strict access controls

-- CreateEnum: AdminRole
DO $$ BEGIN
 CREATE TYPE "AdminRole" AS ENUM('SUPER_ADMIN', 'RISK_ADMIN', 'SUPPORT_ADMIN', 'OPS_ADMIN', 'DEV_ADMIN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AdminPermission
DO $$ BEGIN
 CREATE TYPE "AdminPermission" AS ENUM(
  'VAULT_READ', 'VAULT_DOWNLOAD_RAW', 'VAULT_REJECT_PROOF', 'VAULT_APPROVE_PROOF', 'VAULT_VIEW_METADATA',
  'RIFT_READ', 'RIFT_FORCE_UNDER_REVIEW', 'RIFT_APPROVE', 'RIFT_REJECT', 'RIFT_ESCALATE', 'RIFT_CANCEL',
  'USER_READ', 'USER_RESTRICT', 'USER_FREEZE', 'USER_BAN', 'USER_VERIFY',
  'PAYOUT_READ', 'PAYOUT_PAUSE', 'PAYOUT_SCHEDULE', 'PAYOUT_HOLD',
  'DISPUTE_READ', 'DISPUTE_RESOLVE', 'DISPUTE_REQUEST_INFO',
  'RISK_READ', 'RISK_UPDATE_SCORE', 'RISK_AUTO_HOLD',
  'FEATURE_FLAG_READ', 'FEATURE_FLAG_UPDATE',
  'AUDIT_READ'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AdminAuditAction
DO $$ BEGIN
 CREATE TYPE "AdminAuditAction" AS ENUM(
  'USER_VIEWED', 'USER_FROZEN', 'USER_UNFROZEN', 'USER_BANNED', 'USER_UNBANNED', 'USER_RESTRICTED', 'USER_VERIFIED',
  'RIFT_VIEWED', 'RIFT_FORCE_UNDER_REVIEW', 'RIFT_APPROVED', 'RIFT_REJECTED', 'RIFT_ESCALATED', 'RIFT_CANCELED',
  'VAULT_VIEWED', 'VAULT_DOWNLOADED_RAW', 'VAULT_PROOF_APPROVED', 'VAULT_PROOF_REJECTED',
  'DISPUTE_VIEWED', 'DISPUTE_RESOLVED_SELLER', 'DISPUTE_RESOLVED_BUYER', 'DISPUTE_REQUESTED_INFO',
  'PAYOUT_VIEWED', 'PAYOUT_PAUSED', 'PAYOUT_RESUMED', 'PAYOUT_SCHEDULED', 'PAYOUT_HELD',
  'RISK_SCORE_UPDATED', 'RISK_AUTO_HOLD_SET',
  'FEATURE_FLAG_UPDATED',
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'MFA_ENABLED', 'MFA_DISABLED', 'SESSION_EXPIRED', 'BREAK_GLASS_ACCESSED',
  'ROLE_GRANTED', 'ROLE_REVOKED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable: AdminUser
CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isBreakGlass" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "ssoProvider" TEXT,
    "ssoId" TEXT,
    "deviceTrustTokens" TEXT[],
    "ipAllowlist" TEXT[],
    "sessionDurationHours" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminRole
CREATE TABLE IF NOT EXISTS "admin_roles" (
    "id" TEXT NOT NULL,
    "name" "AdminRole" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminPermission
CREATE TABLE IF NOT EXISTS "admin_permissions" (
    "id" TEXT NOT NULL,
    "name" "AdminPermission" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminRolePermission
CREATE TABLE IF NOT EXISTS "admin_role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminUserRole
CREATE TABLE IF NOT EXISTS "admin_user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "admin_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminAuditLog
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "objectType" TEXT,
    "objectId" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reasonCode" TEXT,
    "notes" TEXT,
    "ipHash" TEXT,
    "sessionId" TEXT,
    "userAgentHash" TEXT,
    "timestampUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AdminSession
CREATE TABLE IF NOT EXISTS "admin_sessions" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceFingerprint" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX IF NOT EXISTS "admin_users_email_idx" ON "admin_users"("email");
CREATE INDEX IF NOT EXISTS "admin_users_isActive_idx" ON "admin_users"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_roles_name_key" ON "admin_roles"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_permissions_name_key" ON "admin_permissions"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_role_permissions_roleId_permissionId_key" ON "admin_role_permissions"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "admin_role_permissions_roleId_idx" ON "admin_role_permissions"("roleId");
CREATE INDEX IF NOT EXISTS "admin_role_permissions_permissionId_idx" ON "admin_role_permissions"("permissionId");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_roles_userId_roleId_key" ON "admin_user_roles"("userId", "roleId");
CREATE INDEX IF NOT EXISTS "admin_user_roles_userId_idx" ON "admin_user_roles"("userId");
CREATE INDEX IF NOT EXISTS "admin_user_roles_roleId_idx" ON "admin_user_roles"("roleId");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminUserId_timestampUtc_idx" ON "admin_audit_logs"("adminUserId", "timestampUtc");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_objectType_objectId_idx" ON "admin_audit_logs"("objectType", "objectId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_timestampUtc_idx" ON "admin_audit_logs"("timestampUtc");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_sessions_sessionToken_key" ON "admin_sessions"("sessionToken");
CREATE INDEX IF NOT EXISTS "admin_sessions_adminUserId_idx" ON "admin_sessions"("adminUserId");
CREATE INDEX IF NOT EXISTS "admin_sessions_sessionToken_idx" ON "admin_sessions"("sessionToken");
CREATE INDEX IF NOT EXISTS "admin_sessions_expiresAt_idx" ON "admin_sessions"("expiresAt");

-- AddForeignKey
DO $$ 
BEGIN
  -- AdminAuditLog -> AdminUser
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_audit_logs_adminUserId_fkey'
    ) THEN
      ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminUserId_fkey" 
        FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- AdminSession -> AdminUser
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_sessions_adminUserId_fkey'
    ) THEN
      ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminUserId_fkey" 
        FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- AdminUserRole -> AdminUser
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_user_roles_userId_fkey'
    ) THEN
      ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- AdminUserRole -> AdminRole
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_roles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_user_roles_roleId_fkey'
    ) THEN
      ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_roleId_fkey" 
        FOREIGN KEY ("roleId") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- AdminRolePermission -> AdminRole
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_roles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_role_permissions_roleId_fkey'
    ) THEN
      ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_roleId_fkey" 
        FOREIGN KEY ("roleId") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
  
  -- AdminRolePermission -> AdminPermission
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_permissions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'admin_role_permissions_permissionId_fkey'
    ) THEN
      ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permissionId_fkey" 
        FOREIGN KEY ("permissionId") REFERENCES "admin_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

