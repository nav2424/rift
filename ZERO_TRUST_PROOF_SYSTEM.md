# Zero-Trust Proof & Delivery System Implementation

**⚠️ DEPRECATED: See `ZERO_TRUST_PROOF_SYSTEM_LAUNCH.md` for launch-scoped documentation**

## Overview

This document describes the comprehensive zero-trust proof and delivery system implemented for Rift, where no party is assumed honest and every dispute can be resolved using recorded facts alone.

**LAUNCH SCOPE:** TICKETS, DIGITAL, SERVICES, LICENSE_KEYS only (PHYSICAL removed)

## Core Design Principles

1. **No Free-Form Uploads** - All proof submissions are type-locked to item type
2. **No Untracked Access** - Every buyer interaction is logged and timestamped
3. **No Unverifiable Proof** - All proofs are hashed, watermarked, and immutable
4. **Everything is Logged** - Tamper-evident hash-chained audit trail
5. **Everything is Replayable** - Complete timeline reconstruction possible

## Key Components

### 1. Type-Locked Proof Validation (`lib/proof-type-validation.ts`)

Enforces that proof submissions match item type requirements at the application level:

**Item Type Requirements:**
- **TICKETS**: Must include event details (eventName, eventDate, platform) and ticket proof (QR code or transfer confirmation)
- **DIGITAL**: Must upload file(s) to Rift Vault (no external links at launch)
- **SERVICES**: Must provide completion summary and deliverables (files, links, or instructions)
- **PHYSICAL**: Must provide tracking number and shipment proof

**Enforcement:**
- Validates asset types match item type
- Checks required fields are present
- Enforces min/max asset counts
- Blocks invalid submissions before database write

### 2. Proof Deadline Enforcement (`lib/proof-deadlines.ts`)

Enforces type-specific proof submission deadlines:

**Deadlines:**
- **TICKETS**: 24-48 hours from FUNDED state
- **DIGITAL**: 24 hours from FUNDED state
- **SERVICES**: Based on agreed delivery date (minimum 24 hours)
- **PHYSICAL**: 48 hours from FUNDED state

**Features:**
- Blocks proof submission after deadline passes
- Calculates access-based auto-release deadlines
- Supports fallback to time-based auto-release

### 3. Duplicate Proof Detection (`lib/duplicate-proof-detection.ts`)

Detects reused proofs across transactions using SHA-256 hash comparison:

**Detection:**
- Compares all asset hashes against existing Rifts
- Identifies same-seller reuse vs. different-seller reuse
- Calculates risk levels (LOW, MEDIUM, HIGH, CRITICAL)

**Actions:**
- Flags Rifts for manual review on duplicate detection
- Blocks critical duplicates (different seller using same proof)
- Automatically increases risk score
- Creates admin alerts for investigation

### 4. Watermarking System (`lib/watermarking.ts`)

Adds invisible watermarks to sensitive assets:

**Supported Assets:**
- Images (ticket proofs) - LSB steganography + EXIF metadata
- PDFs (ticket PDFs) - Metadata watermarking
- License keys - Already encrypted, hash stored

**Features:**
- Embeds transaction ID, Rift number, buyer ID, timestamp
- Survives compression and basic editing
- Can be extracted for verification
- Hash stored for tamper detection

### 5. Enhanced Buyer Access Logging

All buyer interactions are logged as implicit proof:

**Logged Events:**
- `BUYER_OPENED_ASSET` - When buyer views a file
- `BUYER_DOWNLOADED_FILE` - When buyer downloads
- `BUYER_REVEALED_LICENSE_KEY` - When buyer reveals key
- `BUYER_VIEWED_QR` - When buyer views ticket QR
- `BUYER_VIEWED_TRACKING` - When buyer views tracking

**Metadata Captured:**
- Timestamp (UTC)
- IP hash (privacy-preserving)
- User agent hash
- Session ID
- Device fingerprint
- Asset hash at time of access

**Tamper-Evident Chain:**
- Each log entry includes hash of previous entry
- Chain integrity can be verified at any time
- Prevents retroactive log modification

### 6. Access-Based Auto-Release (`lib/auto-release-enhanced.ts`)

Intelligent auto-release based on buyer access patterns:

**Rules:**
- If buyer accesses content, auto-release can happen 24 hours after first access
- Falls back to time-based release if buyer never accesses
- Different deadlines per item type

**Benefits:**
- Faster payouts when buyer accepts delivery
- Prevents "never received" claims after access logged
- Maintains protection window even with access

### 7. Admin Dashboard Enhancements

**Vault Access (`/admin/vault/[riftId]`):**
- View all vault assets with full metadata
- See buyer access history for each asset
- View tamper-evident event log
- Download raw files (with audit logging)
- Preview files/keys in safe viewer

**Duplicate Detection:**
- Check all assets for duplicates across transactions
- View duplicate Rifts with risk assessment
- See recommendations for action
- Search by hash across all transactions

**Hash Comparison:**
- Search for any hash across all Rifts
- See all transactions using same proof
- Identify fraud patterns
- Export evidence for disputes

**Timeline Replay:**
- Complete event history with timestamps
- Buyer access timeline
- Admin action log
- System events

## API Endpoints

### Proof Submission
- `POST /api/rifts/[id]/proof` - Submit proof with type-locked validation

### Vault Access
- `GET /api/rifts/[id]/vault` - Get vault assets (role-based access)
- `POST /api/rifts/[id]/vault` - Open/view asset (logs access)

### Admin Vault
- `GET /api/admin/vault/[riftId]` - Get full vault data
- `POST /api/admin/vault/duplicate-check` - Check for duplicates
- `GET /api/admin/vault/hash-search?hash=...` - Search by hash

## Database Schema Enhancements

### VaultAsset
- `sha256` - SHA-256 hash for duplicate detection
- `scanStatus` - Virus scan status
- `qualityScore` - Proof quality score (0-100)
- `metadataJson` - Additional metadata (page count, text length, etc.)

### VaultEvent
- `logHash` - Hash of this log entry
- `prevLogHash` - Hash of previous entry (chain)
- `ipHash` - Hashed IP address
- `userAgentHash` - Hashed user agent
- `deviceFingerprint` - Device identifier
- `assetHash` - Asset hash at time of event

### RiftTransaction
- `autoReleaseAt` - Calculated auto-release deadline
- `requiresManualReview` - Flag for admin review
- `riskScore` - Updated on duplicate detection

## Dispute-Safe Mechanics

### Buyer Cannot Claim:
- "Never received" after logged access
- "Never opened" after vault interaction
- "Didn't see key" after reveal event logged

### Admin Resolution Uses:
1. Vault logs (tamper-evident chain)
2. Proof hash (SHA-256)
3. Buyer access timeline
4. Chat history
5. Submission timestamps
6. Duplicate detection results

### Evidence Preservation:
- All logs are immutable (hash-chained)
- Proof hashes stored permanently
- Access timestamps cannot be modified
- Admin actions logged with reasons

## Fraud Prevention

### Automatic Flags:
- Reused ticket hashes
- Reused license keys
- Same proof across multiple sellers (CRITICAL)
- Seller disputes above threshold
- Buyers disputing after access repeatedly

### Risk Scoring:
- Increases on duplicate detection
- Increases on suspicious patterns
- Can delay releases
- Can require manual review

## Supported Item Types

### 🎟️ TICKETS
- **Declare**: Event name, date, platform, transfer method
- **Submit**: QR code or transfer confirmation (to Vault)
- **Deadline**: 24-48 hours
- **Auto-release**: 24h after buyer views QR

### 🧑‍💻 SOFTWARE / LICENSE KEYS
- **Declare**: Software name, license type, delivery method
- **Submit**: License key (encrypted in Vault)
- **Deadline**: 24 hours
- **Auto-release**: 24h after buyer reveals key

### 📁 DIGITAL FILES
- **Declare**: File description
- **Submit**: File(s) uploaded to Vault only
- **Deadline**: 24 hours
- **Auto-release**: 24h after buyer opens/downloads

### 🛠️ SERVICES
- **Declare**: Scope, deliverables, delivery date
- **Submit**: Completion form + deliverables
- **Deadline**: Based on agreed date
- **Auto-release**: 72h after submission

## Admin & Employee Access

### Admin Dashboard Capabilities:
- View all vault contents (read-only)
- View access logs (tamper-evident)
- Preview files / masked keys
- Compare proof hashes across transactions
- Replay timeline of events
- Download raw files (logged)

### Employee Roles:
- **Support**: View only (read vault, view logs)
- **Trust & Safety**: Approve/reject proofs (can view + approve/reject)
- **Admin**: Override payouts (full access)

### Every Admin Action:
- Requires reason (logged)
- Timestamped (immutable)
- Non-deletable (audit trail)
- IP hashed (privacy-preserving)

## Implementation Files

### Core Libraries:
- `lib/proof-type-validation.ts` - Type-locked validation
- `lib/proof-deadlines.ts` - Deadline enforcement
- `lib/duplicate-proof-detection.ts` - Duplicate detection
- `lib/watermarking.ts` - Asset watermarking
- `lib/auto-release-enhanced.ts` - Access-based auto-release
- `lib/vault-logging.ts` - Tamper-evident logging

### API Routes:
- `app/api/rifts/[id]/proof/route.ts` - Enhanced proof submission
- `app/api/admin/vault/duplicate-check/route.ts` - Duplicate checking
- `app/api/admin/vault/hash-search/route.ts` - Hash search

### Admin UI:
- `app/admin/vault/[riftId]/page.tsx` - Enhanced vault dashboard

## Testing Checklist

- [ ] Proof type-locked validation blocks invalid submissions
- [ ] Deadlines enforced correctly per item type
- [ ] Duplicate detection flags reused proofs
- [ ] Buyer access properly logged and timestamped
- [ ] Auto-release triggers based on access
- [ ] Admin can view all vault contents
- [ ] Admin can search by hash
- [ ] Admin can detect duplicates
- [ ] Log chain integrity verifiable
- [ ] Watermarking works for images

## Future Enhancements

1. **PDF Watermarking** - Full PDF steganography implementation
2. **Screenshot Detection** - Detect screenshot attempts (future)
3. **Advanced Risk Scoring** - ML-based fraud detection
4. **Legal Evidence Export** - One-click evidence package generation
5. **Real-time Alerts** - Push notifications for critical duplicates

## Security Notes

- All IP addresses and user agents are hashed (SHA-256)
- License keys encrypted at rest
- Watermarks embedded in image pixels (survives compression)
- Log chain prevents retroactive modification
- Admin actions require authentication + reason
- Raw file downloads logged and require re-authentication

---

**Last Updated**: 2025-01-22  
**Status**: ✅ Implemented  
**Zero-Trust Design**: ✅ Complete
