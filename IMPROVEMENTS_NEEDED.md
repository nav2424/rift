# Improvements Needed - Rift Vault System

**Analysis Date**: January 22, 2025  
**Status**: Comprehensive Review

---

## 🔴 CRITICAL - Fix Before Production

### 1. Virus/Malware Scanning ⚠️
**Status**: Placeholder only - NOT IMPLEMENTED  
**Current**: `// Virus/malware scan (placeholder - integrate with actual scanner)`  
**Impact**: CRITICAL - Security vulnerability  
**Priority**: **MUST FIX**

**What's Missing:**
- No actual virus scanning integration
- Files marked as `PENDING` but never actually scanned
- Potential for malicious files to be stored and accessed

**Recommended Solutions:**
1. **ClamAV Integration** (Recommended)
   - Self-hosted or ClamAV Cloud
   - Scan files before allowing upload
   - Update `scanStatus` based on results
   
2. **Cloud-Based Scanning Services**
   - AWS GuardDuty / S3 Object Lambda
   - VirusTotal API (rate limited, may be slow)
   - Google Cloud Security Scanner

3. **Implementation Requirements:**
   ```typescript
   // Background job to scan files
   async function scanFileForVirus(storagePath: string, assetId: string) {
     // 1. Download file from Supabase
     // 2. Scan with ClamAV
     // 3. Update asset.scanStatus (PASS/FAIL)
     // 4. If FAIL, quarantine file and notify admin
   }
   ```

**Action Items:**
- [ ] Set up ClamAV service
- [ ] Create background job for virus scanning
- [ ] Update `performIntegrityChecks` to block infected files
- [ ] Add admin alerts for infected files
- [ ] Implement file quarantine mechanism

---

### 2. Asynchronous Verification ⚠️
**Status**: Currently BLOCKS proof submission response  
**Current**: Verification runs synchronously, can take 10-30 seconds  
**Impact**: HIGH - Poor user experience, timeout risks  
**Priority**: **MUST FIX**

**Current Problem:**
```typescript
// In app/api/rifts/[id]/proof/route.ts
verificationResult = await verifyRiftProofs(rift.id) // BLOCKS HERE
```

**What's Missing:**
- Background job system
- Queue system (Bull, BullMQ, or similar)
- Async verification processing
- Status polling for verification progress

**Recommended Solution:**
1. **Use Background Job Queue**
   - Install BullMQ or similar
   - Queue verification job after asset upload
   - Return immediately to user with "verifying" status
   
2. **Status Updates**
   - Webhook or polling endpoint for verification status
   - Real-time updates via WebSocket (optional)
   - Email notification when verification complete

3. **Implementation:**
   ```typescript
   // After upload, queue verification
   await verificationQueue.add('verify-rift-proofs', {
     riftId: rift.id,
     assetIds: vaultAssetIds
   })
   
   // Return immediately
   return NextResponse.json({
     success: true,
     status: 'PROOF_SUBMITTED',
     verificationStatus: 'PENDING'
   })
   ```

**Action Items:**
- [ ] Install and configure job queue (BullMQ recommended)
- [ ] Create verification worker process
- [ ] Move `verifyRiftProofs` to background job
- [ ] Add verification status endpoint
- [ ] Update UI to poll for verification status
- [ ] Add WebSocket support (optional but nice)

---

### 3. Asset Cleanup on Cancellation/Refund ⚠️
**Status**: Assets remain in storage after rift cancellation  
**Impact**: MEDIUM - Storage costs, data retention compliance  
**Priority**: **HIGH**

**Current Problem:**
- When rift is cancelled, vault assets are NOT deleted
- Files remain in Supabase storage indefinitely
- Database records remain (cascade delete works, but files don't)

**What's Missing:**
- Cleanup logic in cancellation/refund flows
- Soft delete vs hard delete strategy
- Retention policy for cancelled rifts

**Recommended Solution:**
```typescript
// In app/api/rifts/[id]/cancel/route.ts
// After status update, clean up assets
const assets = await prisma.vaultAsset.findMany({
  where: { riftId: id },
  select: { id: true, storagePath: true }
})

// Delete files from Supabase Storage
for (const asset of assets) {
  if (asset.storagePath) {
    await supabase.storage
      .from('rift-vault')
      .remove([asset.storagePath])
  }
}

// Database records deleted via cascade
```

**Action Items:**
- [ ] Add cleanup function for vault assets
- [ ] Call cleanup in cancellation flow
- [ ] Call cleanup in refund flow
- [ ] Consider retention period (e.g., 30 days before hard delete)
- [ ] Add cleanup to dispute resolution (if full refund)

---

### 4. Encryption Key Rotation ⚠️
**Status**: No rotation mechanism  
**Impact**: HIGH - Security best practice  
**Priority**: **HIGH**

**Current Problem:**
- Single encryption key in `VAULT_ENCRYPTION_KEY`
- No mechanism to rotate keys
- All encrypted data uses same key
- If key is compromised, all data is at risk

**What's Missing:**
- Key versioning system
- Multi-key support (current + previous)
- Re-encryption job for old keys
- Key rotation procedure

**Recommended Solution:**
1. **Key Versioning**
   ```typescript
   // Store key version with encrypted data
   interface EncryptedData {
     version: string // e.g., "v1", "v2"
     data: string // encrypted data
   }
   ```

2. **Multi-Key Support**
   - Support multiple keys in environment
   - Try current key first, fall back to previous
   - Log which key was used for decryption

3. **Re-encryption Process**
   - Background job to re-encrypt old data
   - Gradual migration to new key
   - Validation before removing old key

**Action Items:**
- [ ] Design key versioning schema
- [ ] Update encryption/decryption functions to support versioning
- [ ] Create key rotation script
- [ ] Create re-encryption background job
- [ ] Document rotation procedure
- [ ] Test rotation process

---

### 5. Rate Limiting & DDoS Protection ⚠️
**Status**: No rate limiting  
**Impact**: HIGH - Security and cost risk  
**Priority**: **HIGH**

**What's Missing:**
- Rate limiting on upload endpoints
- Per-user upload quotas
- Request size limits (already have file size, but not total request size)
- IP-based rate limiting

**Recommended Solution:**
1. **Use Middleware (Next.js or Express)**
   ```typescript
   // Rate limit: 10 uploads per minute per user
   import rateLimit from 'express-rate-limit'
   
   const uploadLimiter = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 10,
     keyGenerator: (req) => req.userId, // Per user
   })
   ```

2. **IP-Based Rate Limiting**
   - Prevent abuse from single IP
   - Use Redis for distributed rate limiting
   - Different limits for authenticated vs unauthenticated

3. **Upload Quotas**
   - Daily upload limit per user (e.g., 100MB/day)
   - Monthly quota limits
   - Admin override capability

**Action Items:**
- [ ] Install rate limiting library
- [ ] Add rate limiting middleware to upload endpoints
- [ ] Configure per-user limits
- [ ] Add IP-based rate limiting
- [ ] Add upload quota tracking
- [ ] Add admin override capability

---

## 🟡 HIGH PRIORITY - Fix Soon

### 6. Background Job System
**Status**: Not implemented  
**Priority**: HIGH

**Needed For:**
- Asynchronous verification (see #2)
- Virus scanning (see #1)
- Asset cleanup
- Email notifications
- Scheduled tasks (cleanup, retention)

**Recommended:**
- BullMQ with Redis
- Separate worker process
- Job retry logic
- Job monitoring dashboard

---

### 7. File Duplicate Detection Across Platform
**Status**: Partial - only checks same uploader  
**Priority**: HIGH

**Current:**
```typescript
// Only checks same uploader
const duplicateCount = await prisma.vaultAsset.count({
  where: {
    sha256: asset.sha256,
    uploaderId: asset.uploaderId, // Same uploader only
  },
})
```

**What's Missing:**
- Cross-user duplicate detection
- Flag duplicate files uploaded by different users
- Potential fraud/scam detection

**Action:**
- Remove `uploaderId` restriction (or make it optional)
- Add duplicate detection across all users
- Flag for admin review if duplicate detected

---

### 8. PDF Metadata Extraction
**Status**: Placeholder - uses stored metadata if available  
**Priority**: MEDIUM

**Current:**
```typescript
// Extract PDF metadata (simplified - in production use pdf-lib or similar)
// For now, use stored metadata if available
```

**Recommended:**
- Use `pdf-lib` or `pdf-parse` to extract:
  - Page count
  - Text content
  - Creation date
  - Modification date
  - Author, title, subject
- Store in `metadataJson`
- Use for quality scoring

---

### 9. Asset Retention & Archival
**Status**: No retention policy  
**Priority**: MEDIUM

**What's Missing:**
- Automatic archival after rift completion
- Retention periods (e.g., 90 days active, then archive)
- Long-term storage (cheaper storage tier)
- Deletion policy (e.g., delete after 1 year)

**Recommended:**
- Background job to identify assets ready for archival
- Move to cold storage (cheaper)
- Keep database records, update storage path
- Scheduled cleanup for expired assets

---

### 10. Error Handling & Rollback Improvements
**Status**: Partial - some operations wrapped in transactions  
**Priority**: MEDIUM

**Current Issues:**
- Not all multi-step operations use transactions
- Partial failures can leave inconsistent state
- No cleanup on transaction rollback

**Recommended:**
- Wrap all multi-step operations in transactions
- Add cleanup on rollback
- Better error messages
- Retry logic for transient failures

---

### 11. Monitoring & Alerting
**Status**: Not implemented  
**Priority**: MEDIUM

**What's Missing:**
- Error monitoring (Sentry, etc.)
- Performance monitoring
- Alert on failed verifications
- Alert on virus detections
- Alert on storage quota approaching limits

**Recommended:**
- Integrate Sentry for error tracking
- Add metrics collection (Prometheus, DataDog)
- Set up alerts for critical failures
- Dashboard for system health

---

### 12. Performance Optimizations
**Status**: Needs optimization  
**Priority**: MEDIUM

**Issues:**
- Visual duplicate detection is O(n) - checks all images
- No caching of verification results
- Multiple database queries could be optimized with joins

**Recommended:**
- Add Redis cache for verification results
- Optimize duplicate detection with indexing
- Use database joins instead of multiple queries
- Add pagination for large result sets

---

## 🟢 MEDIUM PRIORITY - Nice to Have

### 13. Content Security Policy (CSP) Headers
**Status**: Not implemented  
**Priority**: LOW

Add CSP headers to prevent XSS attacks when viewing vault assets.

---

### 14. Asset Versioning
**Status**: Has `supersedesAssetId` but not fully utilized  
**Priority**: LOW

Allow sellers to update/replace assets, maintaining history.

---

### 15. Bulk Operations
**Status**: Not implemented  
**Priority**: LOW

- Bulk asset upload
- Bulk verification
- Bulk deletion (admin)

---

### 16. Advanced Analytics
**Status**: Not implemented  
**Priority**: LOW

- Verification success rates
- Average verification time
- Most common quality issues
- Asset type distribution

---

## 📊 Summary

### Critical (Must Fix Before Production)
1. ✅ Virus/Malware Scanning
2. ✅ Asynchronous Verification
3. ✅ Asset Cleanup on Cancellation
4. ✅ Encryption Key Rotation
5. ✅ Rate Limiting & DDoS Protection

### High Priority (Fix Soon)
6. Background Job System
7. File Duplicate Detection (Cross-User)
8. PDF Metadata Extraction
9. Asset Retention & Archival
10. Error Handling Improvements
11. Monitoring & Alerting
12. Performance Optimizations

### Medium Priority (Nice to Have)
13. Content Security Policy
14. Asset Versioning
15. Bulk Operations
16. Advanced Analytics

---

## 🎯 Recommended Implementation Order

### Phase 1: Critical Security (Week 1-2)
1. Rate Limiting (#5)
2. Background Job System (#6) - Required for others
3. Asynchronous Verification (#2)
4. Virus Scanning (#1)

### Phase 2: Data Management (Week 3-4)
5. Asset Cleanup (#3)
6. Encryption Key Rotation (#4)
7. Asset Retention (#9)

### Phase 3: Quality & Performance (Week 5-6)
8. PDF Metadata Extraction (#8)
9. Performance Optimizations (#12)
10. Duplicate Detection (#7)

### Phase 4: Operations (Week 7+)
11. Monitoring & Alerting (#11)
12. Error Handling (#10)
13. CSP Headers (#13)
14. Analytics (#16)

---

## 📝 Notes

- All critical items should be addressed before production launch
- Background job system (#6) is a prerequisite for several other items
- Virus scanning (#1) can be implemented as a background job once queue system is in place
- Encryption key rotation (#4) can be planned but doesn't block launch if current key is secure
- Rate limiting (#5) should be implemented ASAP to prevent abuse

---

**Last Updated**: January 22, 2025

