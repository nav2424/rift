# Rift Admin Console Implementation

## Overview

A comprehensive, secure admin console with strict RBAC, audit logs, and break-glass controls. Built to prevent accidental exposure, ensure compliance, and create clean paper trails.

## Architecture

### Separate Admin System

- **Separate Routes**: `/api/admin/*` endpoints
- **Separate Auth**: Admin-specific authentication with MFA
- **Separate Database Models**: `AdminUser`, `AdminRole`, `AdminPermission`
- **Separate Sessions**: `AdminSession` model

### Why Separate?

- Prevents accidental exposure in main product
- Allows stronger auth, logging, and controls
- Creates clean paper trail for compliance/investigations
- Enables IP allowlisting and device trust

## Access Control: RBAC/PBAC

### Core Roles

1. **SUPER_ADMIN** (very few people)
   - All permissions
   - Break-glass access
   - Role/permission management

2. **RISK_ADMIN** (disputes, user restrictions, holds)
   - User freeze/ban
   - Dispute resolution
   - Risk score updates
   - Payout holds

3. **SUPPORT_ADMIN** (read-only + limited actions)
   - User/Rift/Dispute read
   - Request info from users
   - Vault viewer access

4. **OPS_ADMIN** (payout visibility, scheduling)
   - Payout read/schedule/pause
   - Rift read
   - Vault viewer

5. **DEV_ADMIN** (read-only prod debugging, feature flags)
   - Read-only access
   - Feature flag updates
   - No money actions

### Permissions

Granular permissions include:
- `VAULT_READ`, `VAULT_DOWNLOAD_RAW`, `VAULT_REJECT_PROOF`
- `RIFT_READ`, `RIFT_FORCE_UNDER_REVIEW`, `RIFT_APPROVE`, `RIFT_REJECT`
- `USER_READ`, `USER_FREEZE`, `USER_BAN`, `USER_RESTRICT`
- `PAYOUT_READ`, `PAYOUT_PAUSE`, `PAYOUT_SCHEDULE`
- `DISPUTE_READ`, `DISPUTE_RESOLVE`
- `RISK_READ`, `RISK_UPDATE_SCORE`
- `FEATURE_FLAG_READ`, `FEATURE_FLAG_UPDATE`
- `AUDIT_READ`

**Rule**: Nobody gets permissions "by default." Roles grant a set of permissions.

## Authentication

### Required Controls

1. **SSO** (Google Workspace / Okta) - if possible
2. **Mandatory MFA** (TOTP or hardware keys)
3. **IP Allowlisting** (office VPN / Cloudflare Access)
4. **Device Trust** (optional but ideal)
5. **Session Duration** (default: 8 hours)
6. **Re-auth Required** for high-risk actions (bans, payout holds, raw downloads)

### Break-Glass Account

- 1-2 accounts only
- Stored in password manager with strict access
- Every use triggers alerts and extra logging
- Flagged in audit logs

## Audit Logging

Every admin action writes an immutable audit record:

**Stored:**
- Admin user ID
- Action type (`AdminAuditAction`)
- Object (riftId/userId/vaultAssetId)
- Before/after JSON diff
- Timestamp UTC
- IP hash + session ID
- Reason code + optional note

**Nothing in Admin Console should happen without an audit trail.**

## Admin Console Modules

### A) Userbase Module

**Endpoints:**
- `GET /api/admin/users` - Search users
- `GET /api/admin/users/[userId]` - Get user details
- `POST /api/admin/users/[userId]/freeze` - Freeze user
- `POST /api/admin/users/[userId]/ban` - Ban user

**Features:**
- Search by email, phone, username, Stripe customer ID
- View user profile + risk tier + dispute history
- See device/session metadata summaries
- Restrictions: freeze, require extra verification, limit max rift amount, ban
- Include "why" fields (reason codes)

### B) Rift Module

**Endpoints:**
- `GET /api/admin/rifts` - List rifts with filters
- `GET /api/admin/rifts/[riftId]` - Get rift details
- `POST /api/admin/rifts/[riftId]/actions` - Perform admin action

**Features:**
- List all rifts with filters:
  - State, amount, item type, risk score
  - Flagged rifts, high value, new seller, repeated disputes
- Rift detail page showing:
  - Timeline (state transitions)
  - Chat logs
  - Vault assets
  - Vault access logs
  - Payment/payout timeline (read-only)
- Admin actions:
  - Force UNDER_REVIEW
  - Reject proof → back to PROOF_SUBMITTED
  - Approve → RELEASED
  - Escalate to DISPUTED
  - Cancel → CANCELED (high privilege only)

### C) Vault Module

**Endpoints:**
- `GET /api/admin/vault/assets/[assetId]/viewer` - Safe viewer (default)
- `GET /api/admin/vault/assets/[assetId]/raw` - Raw download (restricted)

**Two Views:**

1. **Safe Viewer (default)**
   - Open PDFs/files in internal renderer
   - No raw download by default
   - Sees metadata: hash, file type, scan status, quality score

2. **Raw Access (restricted)**
   - Download raw file
   - Reveal license keys
   - View original content bytes
   - Requires:
     - Higher permission (`VAULT_DOWNLOAD_RAW`)
     - Reason code
     - Re-auth prompt
     - Explicit audit log entry

### D) Disputes & Resolution Module

**Features:**
- Queue of disputed rifts
- Evidence panel (buyer vs seller)
- Vault access log summary ("buyer opened file at X time")
- Action buttons:
  - Resolve in favor of seller → RESOLVED → RELEASED/PAYOUT_SCHEDULED
  - Resolve in favor of buyer → RESOLVED → CANCELED
  - Request more proof → back to PROOF_SUBMITTED
- Templated messages to both sides

### E) Risk & Fraud Module

**Features:**
- Risk scoring dashboard
- Alerts:
  - Repeated hash uploads
  - High dispute rate accounts
  - High $ volume new accounts
  - Rapid rift creation patterns
- Automated holds:
  - "Payout delay" for risky sellers
  - "Review required" for risky rifts

### F) Payouts Module

**Features:**
- Read-only for most
- Holds/reserves for risk admins
- Schedule payouts (limited)
- View payout status: RELEASED → PAYOUT_SCHEDULED → PAID_OUT

### G) Feature Flags / Config Module

**Features:**
- Toggle review thresholds
- Dispute windows
- File type allowlists
- Key reveal rules
- Restricted to SUPER_ADMIN / DEV_ADMIN with audit logs

## API Endpoints

### Authentication
- `POST /api/admin/auth/login` - Admin login (with MFA)
- `DELETE /api/admin/auth/login` - Logout
- `GET /api/admin/auth/session` - Get current session

### Users
- `GET /api/admin/users` - Search users
- `GET /api/admin/users/[userId]` - Get user details
- `POST /api/admin/users/[userId]/freeze` - Freeze user
- `POST /api/admin/users/[userId]/ban` - Ban user

### Rifts
- `GET /api/admin/rifts` - List rifts
- `GET /api/admin/rifts/[riftId]` - Get rift details
- `POST /api/admin/rifts/[riftId]/actions` - Perform action (approve/reject/escalate/cancel)

### Vault
- `GET /api/admin/vault/assets/[assetId]/viewer` - Safe viewer
- `GET /api/admin/vault/assets/[assetId]/raw` - Raw download (restricted)

### Disputes
- `GET /api/admin/disputes` - List disputes
- `POST /api/admin/disputes/[id]/resolve` - Resolve dispute

### Audit
- `GET /api/admin/audit` - Get audit logs

## Security Features

### Middleware

**`withAdminAuth`** - Requires admin authentication
**`withAdminPermission`** - Requires specific permission(s)

### Re-Authentication

High-risk actions require re-authentication:
- User bans
- Rift cancellations
- Raw vault downloads
- Payout holds

### IP Allowlisting

Admins can have IP allowlists configured:
- Office VPN ranges
- Cloudflare Access IPs
- Specific IP addresses or CIDR blocks

### Session Management

- Sessions expire after configured duration (default: 8 hours)
- Last activity tracked
- Sessions can be invalidated
- Break-glass sessions trigger alerts

## "Do Not Do This" List

❌ **Letting staff access prod DB directly for support**
- Use admin console only

❌ **"Impersonate user" feature without strict controls**
- Not implemented (by design)

❌ **Storing raw IPs unnecessarily**
- All IPs are hashed in audit logs

❌ **Admin actions without reason codes**
- All actions require reason codes

❌ **Shared admin credentials**
- Each admin has their own account

❌ **Admin panel behind only a password**
- Requires MFA, IP allowlisting, session management

## Setup Instructions

### 1. Database Migration

```bash
npx prisma migrate deploy
# or
npx prisma migrate dev
```

### 2. Seed Roles and Permissions

```bash
npx tsx scripts/seed-admin-roles.ts
```

### 3. Create First Admin User

```typescript
import { hash } from 'bcryptjs'
import { prisma } from './lib/prisma'

const passwordHash = await hash('secure-password', 10)

const adminUser = await prisma.adminUser.create({
  data: {
    email: 'admin@joinrift.co',
    name: 'Admin User',
    passwordHash,
    isActive: true,
  },
})

// Grant SUPER_ADMIN role
const superAdminRole = await prisma.adminRole.findUnique({
  where: { name: 'SUPER_ADMIN' },
})

if (superAdminRole) {
  await prisma.adminUserRole.create({
    data: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  })
}
```

### 4. Configure MFA

After login, admin can enable MFA:
1. Generate TOTP secret
2. Show QR code
3. Verify code
4. Enable MFA

### 5. Configure IP Allowlisting

For production, set up IP allowlists:
- Office VPN: `10.0.0.0/8`
- Cloudflare Access: specific IPs
- Home office: specific IPs

## Best Practices

1. **Use Cloudflare Access** for additional SSO + IP protection
2. **Enable MFA for all admins** (mandatory)
3. **Regular audit log reviews** (weekly)
4. **Break-glass accounts** stored in password manager only
5. **Session monitoring** - alert on unusual activity
6. **Permission reviews** - quarterly role/permission audits
7. **No direct DB access** - use admin console only

## Compliance

The admin console provides:
- **Immutable audit logs** for all actions
- **Reason codes** for consistent decision-making
- **Before/after state** for change tracking
- **IP/user agent hashing** for privacy
- **Session tracking** for access control

This enables:
- Stripe compliance
- Regulatory investigations
- Internal audits
- Fraud investigations

## Next Steps

1. **Build Admin UI** - React components for each module
2. **SSO Integration** - Google Workspace / Okta
3. **Cloudflare Access** - Additional IP protection
4. **Alert System** - Notify on break-glass access, suspicious activity
5. **Feature Flags UI** - Admin interface for toggles
6. **Risk Dashboard** - Visual risk scoring and alerts

## Files Created

- `lib/admin-auth.ts` - Authentication and authorization
- `lib/admin-audit.ts` - Audit logging
- `app/api/admin/middleware.ts` - API middleware
- `app/api/admin/auth/*` - Auth endpoints
- `app/api/admin/users/*` - User management
- `app/api/admin/rifts/*` - Rift management
- `app/api/admin/vault/*` - Vault access
- `prisma/migrations/20250122000001_add_admin_system/migration.sql` - Database migration
- `scripts/seed-admin-roles.ts` - Role/permission seeding

