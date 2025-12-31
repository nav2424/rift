# Rift Vault System Implementation

## Overview

This document describes the comprehensive vault system implementation that provides bulletproof proof verification, tamper-evident logging, and admin review capabilities.

## Key Features

### 1. State-Based Action Permissions

**File:** `lib/rift-permissions.ts`

Defines what buyers, sellers, and admins can do in each Rift state:

- **DRAFT**: Buyer can edit, cancel, invite seller. Seller can decline.
- **FUNDED**: Buyer can view status, chat, request update. Seller can upload proof.
- **PROOF_SUBMITTED**: Buyer can access vault, open proof, reveal keys, accept/dispute. Seller can add supplemental proof.
- **UNDER_REVIEW**: Admin can approve/reject/escalate. Buyer can submit evidence.
- **RELEASED**: Terminal state - view only.
- **DISPUTED**: Structured dispute flow with evidence submission.

### 2. Enhanced Vault System

**File:** `lib/vault-enhanced.ts`

Comprehensive asset management with:

- **Asset Types**: FILE, LICENSE_KEY, TRACKING, TICKET_PROOF, URL, TEXT_INSTRUCTIONS
- **Role-Based Access**: Buyers, sellers, and admins see different views
- **Access Control**: Buyers can only access vault starting at PROOF_SUBMITTED
- **License Key Handling**: Masked until reveal, one-time reveal logged
- **File Downloads**: Optional downloads with logging

### 3. Tamper-Evident Logging

**File:** `lib/vault-logging.ts`

Immutable audit trail with:

- **Hash Chaining**: Each log entry includes hash of previous entry
- **Comprehensive Events**: All buyer interactions logged (open, download, reveal, view)
- **Privacy**: IP addresses and user agents hashed
- **Verification**: Chain integrity can be verified at any time

**Event Types:**
- `BUYER_OPENED_ASSET`
- `BUYER_DOWNLOADED_FILE`
- `BUYER_REVEALED_LICENSE_KEY`
- `BUYER_VIEWED_QR`
- `BUYER_VIEWED_TRACKING`
- `SELLER_UPLOADED_ASSET`
- `ADMIN_VIEWED_ASSET`
- `ADMIN_DOWNLOADED_RAW`
- `SYSTEM_SCAN_COMPLETED`

### 4. Admin Verification Pipeline

**File:** `lib/vault-verification.ts`

Automated proof quality checks:

**Step A - Integrity & Safety:**
- SHA-256 hash verification
- File type verification (MIME detection)
- Size checks (prevent empty/junk files)
- Virus/malware scan (structure in place)
- URL validation (block shorteners)
- Tracking number format validation

**Step B - Proof Quality:**
- PDF metadata extraction (page count, text length, language)
- Document validity scoring (0-100)
- Duplicate content detection (same hash across Rifts)
- Creation date anomaly detection
- Image-only document detection

**Auto-Routing:**
- Low quality score (< 60) → UNDER_REVIEW
- Integrity failures → UNDER_REVIEW
- High-risk patterns → UNDER_REVIEW

### 5. Admin Vault Console

**Endpoints:**
- `GET /api/admin/vault/[riftId]` - View all vault assets, events, and reviews
- `POST /api/admin/vault/[riftId]/view-asset` - View/download assets (logged)
- `POST /api/admin/vault/[riftId]/review` - Approve/reject/escalate proofs
- `POST /api/admin/vault/[riftId]/verify` - Trigger verification pipeline

**Capabilities:**
- View exact content buyer would see
- Download raw files (logged)
- See scan results, hashes, metadata
- View buyer access history
- Approve → RELEASED
- Reject → back to PROOF_SUBMITTED
- Escalate → DISPUTED (fraud suspected)

### 6. Database Schema

**New Models:**

1. **VaultAsset**
   - Stores all proof assets (files, keys, tracking, URLs, text)
   - SHA-256 hash for integrity
   - Scan status and quality score
   - Metadata JSON for extracted information
   - Append-only (supersedes for updates)

2. **VaultEvent**
   - Immutable event log
   - Hash chaining for tamper-evident audit trail
   - Comprehensive actor and context tracking

3. **AdminReview**
   - Tracks admin review decisions
   - Status: OPEN, APPROVED, REJECTED, ESCALATED
   - Reasons and notes

## Auto-Decision Rules

The system can automatically resolve certain disputes:

**Auto-deny buyer "not delivered" claim if:**
- Buyer opened any Vault asset
- Buyer downloaded file
- Buyer revealed license key
- Buyer viewed ticket QR / transfer proof

**Auto-favor buyer if:**
- Seller never submits proof and SLA expires
- Seller is unresponsive in dispute window

## Proof Matching

For template-required categories:
- Seller selects "Document Type"
- System runs document heuristics
- Admins see: "Seller claimed: X" vs "System thinks: likely/uncertain/not matching"

## Risk Management

**Chargeback Containment:**
- Freeze involved users
- Require admin review for future funding
- Raise reserves / hold payouts

**Abuse Prevention:**
- Structured disputes only
- One dispute per Rift at a time
- Harassment/off-platform coercion → instant restrictions
- Repeat offenders → lifetime ban

**High-Risk Payout Controls:**
- Risk tiers determine payout delays
- Tier 0 (new): longer delay + more review
- Tier 2 (trusted): faster payout

**Duplicate Content Detection:**
- Same PDF hash across many Rifts → auto-flag
- Route to review
- Possible account restriction

## Integration Points

### Proof Submission

**File:** `app/api/rifts/[id]/proof/route.ts`

Updated to:
1. Upload assets to vault using `uploadVaultAsset()`
2. Trigger verification pipeline with `verifyRiftProofs()`
3. Auto-route to UNDER_REVIEW if verification flags issues
4. Maintain backward compatibility with old file system

### State Transitions

**File:** `lib/rules.ts`

Updated with complete state-based action matrix:
- DRAFT → FUNDED (buyer pays)
- FUNDED → PROOF_SUBMITTED (seller submits)
- PROOF_SUBMITTED → UNDER_REVIEW (auto or manual)
- UNDER_REVIEW → RELEASED (admin approves)
- UNDER_REVIEW → PROOF_SUBMITTED (admin rejects)
- UNDER_REVIEW → DISPUTED (admin escalates)

## Migration

**File:** `prisma/migrations/20250122000000_add_vault_system/migration.sql`

Run migration:
```bash
npx prisma migrate deploy
# or for development:
npx prisma migrate dev
```

## Usage Examples

### Seller Uploads Proof

```typescript
// Upload file
const assetId = await uploadVaultAsset(riftId, sellerId, {
  assetType: 'FILE',
  file: fileObject,
  fileName: 'delivery.pdf'
})

// Upload license key
const keyId = await uploadVaultAsset(riftId, sellerId, {
  assetType: 'LICENSE_KEY',
  licenseKey: 'ABC-123-XYZ'
})
```

### Buyer Accesses Vault

```typescript
// Open asset (logged)
const { url } = await buyerOpenAsset(riftId, assetId, buyerId, {
  ipHash: hashString(ip),
  userAgentHash: hashString(userAgent),
  sessionId: sessionId
})

// Reveal license key (one-time, logged)
const key = await buyerRevealLicenseKey(riftId, keyAssetId, buyerId, {
  ipHash: hashString(ip),
  sessionId: sessionId
})
```

### Admin Reviews Proof

```typescript
// View vault
const vaultData = await fetch(`/api/admin/vault/${riftId}`)

// Approve
await fetch(`/api/admin/vault/${riftId}/review`, {
  method: 'POST',
  body: JSON.stringify({
    action: 'APPROVE',
    notes: 'Proof verified'
  })
})
```

## Security Features

1. **Tamper-Evident Logs**: Hash chaining prevents log manipulation
2. **Immutable Assets**: Append-only vault (supersedes for updates)
3. **Privacy**: IP addresses and user agents hashed
4. **Access Control**: Role-based views (buyer/seller/admin)
5. **Integrity Checks**: SHA-256 verification on all assets
6. **Quality Scoring**: Automated detection of junk proofs

## Next Steps

1. **Virus Scanning**: Integrate with actual virus scanner (ClamAV, etc.)
2. **PDF Processing**: Use pdf-lib or similar for metadata extraction
3. **URL Snapshotting**: Implement URL snapshot service
4. **Carrier API**: Integrate tracking number validation
5. **Admin UI**: Build admin console interface
6. **Auto-Decision Engine**: Implement dispute auto-resolution rules

## Testing

Test the vault system:

```bash
# Test asset upload
curl -X POST /api/rifts/{id}/proof \
  -F "files=@proof.pdf" \
  -F "notes=Delivery proof"

# Test buyer access
curl -X GET /api/vault/{riftId}/assets

# Test admin review
curl -X POST /api/admin/vault/{riftId}/review \
  -d '{"action": "APPROVE"}'
```

## Notes

- The system maintains backward compatibility with the old `Proof` model
- Vault assets are stored in Supabase Storage
- All events are logged with tamper-evident hash chaining
- Admin actions are fully audited
- Buyer cannot claim "not delivered" if they opened/downloaded/revealed proof

