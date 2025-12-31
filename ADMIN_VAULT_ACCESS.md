# Admin Vault Access Guide

## Overview

The Rift Vault provides admins with secure access to view and download proof assets (files, license keys, tracking numbers, etc.) submitted by sellers.

## Authentication

Currently, vault endpoints use the standard admin session check (`session.user.role === 'ADMIN'`). For production, consider updating to use the new admin authentication system (`requireAdminAuth` from `lib/admin-auth.ts`).

## API Endpoints

### 1. Get Vault Data for a Rift

**Endpoint:** `GET /api/admin/vault/[riftId]`

**Description:** Get all vault assets, events, and reviews for a specific Rift

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/vault/cmjku4eho0001n6438nrhqmzb" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**Response:**
```json
{
  "rift": {
    "id": "cmjku4eho0001n6438nrhqmzb",
    "riftNumber": 123,
    "status": "PROOF_SUBMITTED",
    "itemType": "DIGITAL",
    "itemTitle": "Software License",
    "buyer": { "id": "...", "email": "buyer@example.com" },
    "seller": { "id": "...", "email": "seller@example.com" }
  },
  "assets": [
    {
      "id": "asset-id",
      "assetType": "FILE",
      "fileName": "delivery.pdf",
      "sha256": "...",
      "scanStatus": "PASS",
      "qualityScore": 85,
      "createdAt": "2025-01-22T...",
      "buyerAccessHistory": [
        {
          "eventType": "BUYER_OPENED_ASSET",
          "timestampUtc": "2025-01-22T...",
          "ipHash": "...",
          "sessionId": "..."
        }
      ]
    }
  ],
  "events": [...],
  "reviews": [...]
}
```

### 2. View Asset (Safe Viewer)

**Endpoint:** `GET /api/admin/vault/assets/[assetId]/viewer`

**Description:** Get a safe viewer URL for an asset (same view as buyer sees)

**Required Permission:** `VAULT_READ` (if using new admin system)

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/vault/assets/asset-id/viewer" \
  -H "Cookie: admin_session=YOUR_ADMIN_SESSION"
```

**Response:**
```json
{
  "asset": {
    "id": "asset-id",
    "assetType": "FILE",
    "fileName": "delivery.pdf",
    "sha256": "...",
    "scanStatus": "PASS",
    "qualityScore": 85,
    "metadataJson": { "pageCount": 5, "textLength": 1500 }
  },
  "viewerUrl": "https://supabase-storage-url/...",
  "textContent": null,
  "trackingNumber": null,
  "url": null
}
```

### 3. Download Raw File (Restricted)

**Endpoint:** `GET /api/admin/vault/assets/[assetId]/raw?reAuthPassword=PASSWORD&reasonCode=ADMIN_REVIEW`

**Description:** Download raw file (requires re-authentication)

**Required Permission:** `VAULT_DOWNLOAD_RAW` (if using new admin system)

**Parameters:**
- `reAuthPassword` (required): Admin password for re-authentication
- `reasonCode` (optional): Reason for raw download (default: "ADMIN_REVIEW")

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/admin/vault/assets/asset-id/raw?reAuthPassword=your-password&reasonCode=DISPUTE_INVESTIGATION" \
  -H "Cookie: admin_session=YOUR_ADMIN_SESSION"
```

**Response:**
```json
{
  "downloadUrl": "https://supabase-storage-url/...",
  "asset": {
    "id": "asset-id",
    "assetType": "FILE",
    "fileName": "delivery.pdf",
    "sha256": "...",
    "mimeDetected": "application/pdf",
    "sizeBytes": 12345
  },
  "expiresIn": 300
}
```

### 4. Review Proof (Approve/Reject/Escalate)

**Endpoint:** `POST /api/admin/vault/[riftId]/review`

**Description:** Approve, reject, or escalate proof

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/admin/vault/cmjku4eho0001n6438nrhqmzb/review" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "action": "APPROVE",
    "reasonCode": "PROOF_VERIFIED",
    "notes": "All documents verified"
  }'
```

**Actions:**
- `APPROVE` - Approve proof → transitions to RELEASED
- `REJECT` - Reject proof → transitions back to PROOF_SUBMITTED (request resubmission)
- `ESCALATE` - Escalate to DISPUTED (fraud suspected)

**Response:**
```json
{
  "success": true,
  "review": { "id": "...", "status": "APPROVED" },
  "newStatus": "RELEASED"
}
```

### 5. Trigger Verification Pipeline

**Endpoint:** `POST /api/admin/vault/[riftId]/verify`

**Description:** Manually trigger verification pipeline for a Rift

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/admin/vault/cmjku4eho0001n6438nrhqmzb/verify" \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=YOUR_ADMIN_SESSION" \
  -d '{"assetId": "optional-asset-id"}'
```

## Using from Code/Admin UI

### JavaScript/TypeScript Example

```typescript
// Get vault data for a Rift
async function getVaultData(riftId: string) {
  const response = await fetch(`/api/admin/vault/${riftId}`, {
    credentials: 'include',
  })
  const data = await response.json()
  return data
}

// View asset in safe viewer
async function viewAsset(assetId: string) {
  const response = await fetch(`/api/admin/vault/assets/${assetId}/viewer`, {
    credentials: 'include',
  })
  const data = await response.json()
  return data.viewerUrl
}

// Download raw file (requires re-auth)
async function downloadRaw(assetId: string, password: string, reason: string) {
  const response = await fetch(
    `/api/admin/vault/assets/${assetId}/raw?reAuthPassword=${encodeURIComponent(password)}&reasonCode=${reason}`,
    { credentials: 'include' }
  )
  const data = await response.json()
  return data.downloadUrl
}

// Approve proof
async function approveProof(riftId: string, reason: string, notes?: string) {
  const response = await fetch(`/api/admin/vault/${riftId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      action: 'APPROVE',
      reasonCode: reason,
      notes,
    }),
  })
  return response.json()
}
```

## What You Can See

When accessing vault data, admins can see:

1. **All Assets:**
   - File name, type, size
   - SHA-256 hash
   - Scan status (PENDING/PASS/FAIL)
   - Quality score (0-100)
   - Metadata (page count, text length, etc.)
   - Storage path

2. **Buyer Access History:**
   - When buyer opened asset
   - When buyer downloaded file
   - When buyer revealed license key
   - IP hash, session ID, timestamps

3. **Vault Events:**
   - All events logged for this Rift
   - Buyer interactions
   - Admin actions
   - System verification events

4. **Admin Reviews:**
   - Previous review decisions
   - Reviewer information
   - Notes and reasons

## Security Notes

1. **Audit Logging:** All admin vault access is logged
2. **Re-authentication:** Raw downloads require password re-entry
3. **Permissions:** Different actions require different permissions (when using new admin system)
4. **IP Hashing:** Buyer IPs are hashed for privacy

## Next Steps

For production use:
1. Update vault endpoints to use `requireAdminAuth` from `lib/admin-auth.ts`
2. Build admin UI components for vault access
3. Add search/filter capabilities
4. Add bulk actions for multiple rifts

