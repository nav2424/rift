# Zero-Trust Proof & Delivery System — Launch Scope

## Launch Item Types (ONLY)

✅ **TICKETS**  
✅ **DIGITAL**  
✅ **SERVICES**  
✅ **LICENSE_KEYS / SOFTWARE**  

❌ **PHYSICAL** — Removed from launch scope (no tracking, no shipment proof)

---

## 1. Type-Locked Proof Validation

**File:** `lib/proof-type-validation.ts`

### TICKETS
- **Required:** Event details (eventName, eventDate, platform)
- **Assets:** Platform transfer confirmation **OR** QR asset (uploaded to Vault)
- **Allowed:** `TICKET_PROOF`, `FILE`
- **Min/Max:** 1-5 assets

### DIGITAL
- **Required:** None (file itself is proof)
- **Assets:** Vault file upload **ONLY** (no external links at launch)
- **Allowed:** `FILE` only
- **Min/Max:** 1-10 assets

### SERVICES
- **Required:** Delivery summary, scope completion
- **Assets:** Deliverables (files, URLs, or instructions)
- **Special:** If URL provided, snapshot proof required
- **Allowed:** `FILE`, `URL`, `TEXT_INSTRUCTIONS`
- **Min/Max:** 0-20 assets

### LICENSE_KEYS / SOFTWARE
- **Required:** Software name, license type
- **Assets:** Masked key entry **OR** account invite proof **OR** vault-hosted download
- **Allowed:** `LICENSE_KEY`, `FILE`, `URL`
- **Min/Max:** 1-5 assets

**Hard Rule:** No "other", no free-form uploads, no bypass routes.

---

## 2. Proof Deadline Enforcement

**File:** `lib/proof-deadlines.ts`

| Item Type | Deadline | Auto-Release After Access | Auto-Release Fallback |
|-----------|----------|---------------------------|----------------------|
| TICKETS | 24-48h | 24h after buyer views QR | 48h after submission |
| DIGITAL | 24h | 24h after buyer opens/downloads | 48h after submission |
| LICENSE_KEYS | 24h | 24h after buyer reveals key | 48h after submission |
| SERVICES | Based on agreed delivery date (+ grace window) | N/A | 72h after submission |

**Blocks proof submission after deadline** → Forces admin review path if needed.

---

## 3. Duplicate Proof Detection

**File:** `lib/duplicate-proof-detection.ts`

**Hashing Strategy:**
- **SHA-256** of raw file bytes (exact match)
- **Canonical hashing** (normalized content) to prevent "same file slightly modified" evasion
  - **Images:** Resize to standard size, strip metadata, perceptual hash (pHash)
  - **PDFs:** Normalize metadata, render first page, hash both original + rendered
  - **Text:** Normalize whitespace, encoding, line endings

**Risk Levels:**
- **LOW:** Same seller, first reuse
- **MEDIUM:** Same seller, multiple reuses
- **HIGH:** Same seller, completed Rifts
- **CRITICAL:** Different seller using same proof

**Actions:**
- Auto-block CRITICAL duplicates
- Flag HIGH/MEDIUM for manual review
- Require admin override with reason

---

## 4. Watermarking (Launch-Grade)

**File:** `lib/watermarking.ts`

**Primary Protection:** Viewer-first design with server-side controlled reveal

**Approach:**
1. **Viewer-only access** for tickets, keys, high-value digital
2. **Dynamic watermark overlays** on render (per-session, per-buyer)
3. **Invisible watermark** as backup layer (EXIF + optional LSB)
   - **Note:** EXIF easily stripped, LSB destroyed by re-encoding
   - **Rely on logging as primary truth**

**Implementation:**
- QR/sensitive assets revealed only in Rift viewer
- Watermark overlays on render (dynamic, per-view)
- Buyer identity + transaction ID embedded per session
- Original stored without overlay (overlay applied server-side on serve)

---

## 5. Buyer Access Logging (Critical)

**Every buyer interaction logged:**

| Event Type | When Logged |
|------------|-------------|
| `BUYER_OPENED_ASSET` | View file |
| `BUYER_DOWNLOADED_FILE` | Download initiated |
| `BUYER_REVEALED_LICENSE_KEY` | Key revealed |
| `BUYER_VIEWED_QR` | QR code viewed |
| `BUYER_VIEWED_TRACKING` | Tracking viewed |
| `BUYER_CLICKED_EXTERNAL_LINK` | Link clicked |
| `BUYER_COPIED_KEY` | Key copied (future) |

**Metadata Captured:**
- Timestamp (UTC)
- User ID
- Asset ID
- Transaction ID
- IP hash (SHA-256)
- User agent hash
- Session ID
- Device fingerprint

**This is the "never received" killer feature.**

---

## 6. Access-Based Auto-Release

**File:** `lib/auto-release-enhanced.ts`

**Primary Trigger:** First buyer access event

**Example Flow:**
1. Seller submits proof → Rift status: `PROOF_SUBMITTED`
2. Buyer opens/downloads/reveals → Access logged
3. Auto-release clock starts: **24h after first access**
4. If no access: Falls back to time-based (48h after submission)

**Benefits:**
- Faster payouts when buyer accepts delivery
- Prevents "never received" claims (access logged)
- Maintains protection window even with access

---

## 7. Tamper-Evident Audit Trail

**File:** `lib/audit-chain-enhanced.ts`

**Requirements:**
- Hash-chained events (each includes prev_event_hash)
- Daily root signatures (server-signed, chained across days)
- Admin events included in chain (no "admin invisibility")
- Verifiable integrity at any time

**Implementation:**
- Event chain: Each event includes hash of previous event
- Daily roots: All events for day → Merkle-style hash → signed
- Previous day hash included in root (cross-day chaining)
- Server key signs daily roots (RSA-SHA256)

**Verification:**
- Event chain integrity check
- Daily root signature verification
- Cross-day chain validation
- Admin event inclusion verification

---

## 8. Viewer-First Design

**File:** `lib/viewer-first-access.ts`

**For tickets, keys, and high-value digital:**

**Default Behavior:**
- Prevent raw access by default
- Force viewer reveal
- Log reveal + copy events
- One-time reveal for keys (with admin override)

**Implementation:**
- Assets served through `/api/rifts/[id]/vault/viewer/[assetId]` endpoint
- No direct S3/storage URLs (all access logged)
- Dynamic watermark overlays applied server-side
- License keys: One reveal per buyer (admin can override)

---

## 9. Admin Dashboard

**Vault Viewer** (`/admin/vault/[riftId]`):
- View all vault assets (read-only)
- Preview files/keys in safe viewer
- See buyer access history per asset
- Download raw files (logged, requires reason)

**Duplicate Detection:**
- Check all assets for duplicates
- View duplicate Rifts with risk assessment
- Search by hash across all transactions
- See recommendations for action

**Timeline Replay:**
- Complete event history with timestamps
- Buyer access timeline
- Admin action log (with reasons)
- System events

**Hash Comparison:**
- Search for any hash across all Rifts
- See all transactions using same proof
- Identify fraud patterns
- Export evidence for disputes

---

## 10. Risk Flagging

**Automatic Flags:**
- Duplicate proof detection → Risk score jump
- Repeated disputes after access
- Multiple transactions using same proof hash
- Rapid submissions across many transactions

**Actions:**
- Auto-block CRITICAL duplicates
- Flag for manual review
- Increase risk score
- Admin alerts for investigation

---

## Production Checklist

### ✅ Completed

- [x] LICENSE_KEYS included in type-lock validation
- [x] PHYSICAL removed from code paths
- [x] Canonical hashing infrastructure (images, PDFs, text)
- [x] Viewer-first design for sensitive assets
- [x] Access logs are append-only + included in audit chain
- [x] Admin actions logged + reason required
- [x] Auto-release uses access-events as primary trigger
- [x] Type-locked validation (no free-form uploads)

### ⚠️ Requires Schema Migration

- [ ] Add `LICENSE_KEYS` to `ItemType` enum in Prisma schema
- [ ] Create `daily_roots` table for audit chain
- [ ] Add `canonicalSha256` column to `VaultAsset` table
- [ ] Add `perceptualHash` column to `VaultAsset` table (optional)

### 🔧 TODO (Pre-Launch)

- [ ] Implement perceptual hashing (pHash) for images
- [ ] Complete PDF canonical hashing (render-to-image)
- [ ] Implement daily root generation cron job
- [ ] Add rate limits on proof submissions/downloads/reveals
- [ ] Test suite: deadline blocks, duplicate blocks, access logs, timeline replay
- [ ] Ensure write-once storage (content-addressed)
- [ ] Verify no direct S3 URLs accessible outside app
- [ ] Replace all "escrow" language with "Rift" language

---

## Language Guide

**Replace:**
- "escrow" → "Rift" / "PAID" / "release" / "payout"
- "EscrowTransaction" → "RiftTransaction" (already done in most places)
- "escrowId" → "riftId" (in code)
- "funded" → "PAID" (in user-facing text)

**Keep:**
- Internal status: `FUNDED` (database enum)
- Internal status: `PROOF_SUBMITTED` (database enum)
- Internal status: `RELEASED` (database enum)

**User-Facing Labels:**
- "Funded" → "Paid"
- "Proof Submitted" → "Delivery Submitted"
- "Released" → "Funds Released"

---

## Schema Changes Required

```prisma
enum ItemType {
  DIGITAL
  TICKETS
  SERVICES
  LICENSE_KEYS  // ADD THIS
  // PHYSICAL removed
}

model DailyRoot {
  id              String   @id @default(cuid())
  date            String   @unique // YYYY-MM-DD
  rootHash        String   @unique
  previousDayHash String?
  signature       String
  eventCount      Int
  createdAt       DateTime @default(now())
  
  @@map("daily_roots")
}

model VaultAsset {
  // ... existing fields ...
  canonicalSha256 String?  // ADD: Normalized content hash
  perceptualHash  String?  // ADD: Perceptual hash for images (optional)
}
```

---

## Testing Requirements

### Deadline Blocks
- [ ] Test proof submission blocked after deadline
- [ ] Test admin override with reason

### Duplicate Blocks
- [ ] Test CRITICAL duplicate auto-block
- [ ] Test HIGH/MEDIUM duplicate flagging
- [ ] Test canonical hash detection

### Access Logs
- [ ] Test all buyer events logged
- [ ] Test log chain integrity
- [ ] Test admin events in chain

### Timeline Replay
- [ ] Test complete event reconstruction
- [ ] Test buyer access timeline accuracy
- [ ] Test daily root verification

---

**Status:** ✅ Core implementation complete  
**Remaining:** Schema migration, perceptual hashing, rate limits, test suite

**Last Updated:** 2025-01-22
