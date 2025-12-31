# Manual Testing Guide - End-to-End Security & Functionality

This guide walks you through comprehensive manual testing of the Rift Vault system.

---

## 🔐 1. ENCRYPTION TESTING

### Test License Key Encryption

1. **Create a Test Rift**
   - Create a new rift as a seller
   - Set item type to `DIGITAL`
   - Set a price and complete the rift setup

2. **Upload a License Key**
   - As the seller, click "Add File/PDF to Vault" or "Add Proof to Vault"
   - Enter a license key (e.g., `TEST-KEY-12345-ABCDEF`)
   - Submit the proof

3. **Verify Encryption in Database**
   ```sql
   SELECT id, assetType, encryptedData, sha256 
   FROM vault_assets 
   WHERE assetType = 'LICENSE_KEY' 
   ORDER BY createdAt DESC 
   LIMIT 1;
   ```
   - ✅ Verify `encryptedData` is NOT the plain text license key
   - ✅ Verify `encryptedData` is NOT base64-encoded plain text
   - ✅ Verify `encryptedData` starts with encryption format indicators

4. **Test Decryption as Buyer**
   - Log in as the buyer
   - Navigate to the rift detail page
   - Click "View Vault" or similar
   - Click "Reveal License Key"
   - ✅ Verify the original license key is displayed correctly
   - ✅ Verify the key matches what was uploaded

5. **Test Encryption Uniqueness**
   - Upload the same license key again
   - Check database: `SELECT encryptedData FROM vault_assets WHERE ...`
   - ✅ Verify the encrypted values are DIFFERENT (due to random IV)
   - ✅ Verify both can be decrypted to the same original key

6. **Test Invalid Decryption**
   - Try to decrypt malformed encrypted data (should fail gracefully)
   - ✅ Verify proper error handling

---

## 📤 2. ASSET UPLOAD TESTING

### Test License Key Upload

1. **Valid License Keys**
   - Upload: `ABC123-XYZ789-123456` ✅ Should succeed
   - Upload: `Test_Key_123` ✅ Should succeed
   - Upload: `VALID-123` ✅ Should succeed (minimum 5 chars)

2. **Invalid License Keys**
   - Upload: `ABC` ❌ Should fail (too short, < 5 chars)
   - Upload: `A`.repeat(501) ❌ Should fail (too long, > 500 chars)
   - Upload: `TEST@KEY#123` ❌ Should fail (invalid characters)
   - Upload: `TEST KEY 123` ❌ Should fail (spaces not allowed)

### Test URL Upload

1. **Valid URLs**
   - Upload: `https://example.com/download` ✅ Should succeed
   - Upload: `http://example.com/file` ✅ Should succeed

2. **Invalid URLs**
   - Upload: `not-a-valid-url` ❌ Should fail
   - Upload: `ftp://example.com/file` ❌ Should fail (not HTTP/HTTPS)
   - Upload: `javascript:alert(1)` ❌ Should fail

### Test File Upload

1. **Valid Files**
   - Upload PDF (e.g., `proof.pdf`) ✅ Should succeed
   - Upload image (e.g., `screenshot.png`) ✅ Should succeed
   - Upload ZIP file (for digital items) ✅ Should succeed

2. **Invalid Files**
   - Upload file > 50MB ❌ Should fail
   - Upload file < 100 bytes ❌ Should fail (too small)
   - Upload executable file (.exe) ❌ Should fail (if blocked)

### Test Access Control

1. **Seller Can Upload**
   - As seller, upload proof ✅ Should succeed

2. **Buyer Cannot Upload**
   - As buyer, try to upload proof ❌ Should fail with authorization error

3. **Non-Participant Cannot Upload**
   - As third user, try to upload proof ❌ Should fail

4. **Wrong Status**
   - Create rift in `DRAFT` status
   - Try to upload proof ❌ Should fail with status error

---

## 🔍 3. VERIFICATION PIPELINE TESTING

### Test Automatic Verification

1. **Upload Proof**
   - Upload a license key or file
   - ✅ Verify verification pipeline runs automatically

2. **Check Verification Results**
   ```sql
   SELECT id, scanStatus, qualityScore, metadataJson 
   FROM vault_assets 
   WHERE riftId = '<rift-id>' 
   ORDER BY createdAt DESC;
   ```
   - ✅ Verify `scanStatus` is set (PENDING, PASS, or FAIL)
   - ✅ Verify `qualityScore` is set (0-100)
   - ✅ Verify `metadataJson` contains analysis results

3. **Test AI Analysis (if configured)**
   - Upload an image (screenshot, receipt, etc.)
   - Check `metadataJson` for `aiAnalysis` field
   - ✅ Verify AI analysis results are present
   - ✅ Verify extracted text, quality scores, etc.

### Test State Transitions

1. **FUNDED -> PROOF_SUBMITTED**
   - Create rift in `FUNDED` status
   - Upload proof
   - ✅ Verify rift transitions to `PROOF_SUBMITTED` or `UNDER_REVIEW`

2. **Based on Verification Results**
   - Upload high-quality proof (qualityScore > 90)
   - ✅ Verify state transitions appropriately
   - Upload low-quality proof (qualityScore < 60)
   - ✅ Verify state routes to `UNDER_REVIEW`

---

## 👤 4. BUYER ACCESS TESTING

### Test License Key Reveal

1. **First Reveal**
   - As buyer, navigate to rift
   - Click "Reveal License Key"
   - ✅ Verify key is displayed
   - ✅ Verify key matches what seller uploaded

2. **Second Reveal Attempt**
   - Try to reveal the same key again
   - ❌ Should fail (one-time reveal only)

3. **Check Event Logging**
   ```sql
   SELECT * FROM vault_events 
   WHERE assetId = '<asset-id>' 
   AND eventType = 'BUYER_REVEALED_LICENSE_KEY';
   ```
   - ✅ Verify event is logged with timestamp
   - ✅ Verify event includes buyer information

### Test File Access

1. **View File**
   - As buyer, click to view/download file
   - ✅ Verify file opens correctly
   - ✅ Verify download works

2. **Check Event Logging**
   ```sql
   SELECT * FROM vault_events 
   WHERE assetId = '<asset-id>' 
   AND eventType IN ('BUYER_OPENED_ASSET', 'BUYER_DOWNLOADED_FILE');
   ```
   - ✅ Verify events are logged

### Test URL Access

1. **Open URL**
   - As buyer, click URL link
   - ✅ Verify URL opens in new tab/window
   - ✅ Verify event is logged

---

## 🔒 5. SECURITY TESTING

### Test Encryption Key Missing

1. **Temporarily Remove Key**
   - Remove `VAULT_ENCRYPTION_KEY` from `.env`
   - Restart server
   - Try to encrypt a license key
   - ❌ Should fail with clear error message
   - ✅ Restore key and verify it works again

### Test Invalid Encrypted Data

1. **Try to Decrypt Invalid Data**
   - Manually set invalid `encryptedData` in database
   - Try to decrypt
   - ❌ Should fail gracefully
   - ✅ Should not crash the application

### Test Access Control

1. **Cross-User Access**
   - User A creates rift with license key
   - User B tries to reveal User A's license key
   - ❌ Should fail with authorization error

2. **Database Direct Access**
   - Try to query `encryptedData` directly from database
   - ✅ Verify encrypted data is not usable without decryption function
   - ✅ Verify decryption requires proper authorization

---

## 🛡️ 6. ERROR HANDLING TESTING

### Test Validation Errors

1. **Missing Required Fields**
   - Try to upload license key without value ❌ Should fail
   - Try to upload URL without value ❌ Should fail
   - Try to upload file without file ❌ Should fail

2. **Invalid Asset Types**
   - Try to upload with invalid `assetType` ❌ Should fail

3. **Database Errors**
   - Test with invalid `riftId` ❌ Should fail gracefully
   - Test with non-existent user ❌ Should fail gracefully

---

## 📊 7. ADMIN FUNCTIONALITY TESTING

### Test Admin Vault Access

1. **View Vault**
   - As admin, navigate to admin panel
   - Click "Vault" for a rift
   - ✅ Verify all assets are visible
   - ✅ Verify event logs are visible
   - ✅ Verify admin reviews are visible

2. **View Asset**
   - Click "View" on an asset
   - ✅ Verify asset opens in safe viewer
   - ✅ Verify license keys can be decrypted

3. **Raw Download**
   - Click "Raw Download" (if permitted)
   - ✅ Verify download works
   - ✅ Verify event is logged

### Test Admin Review

1. **Approve Proof**
   - As admin, review proof
   - Click "Approve"
   - ✅ Verify rift state transitions
   - ✅ Verify audit log is created

2. **Reject Proof**
   - As admin, click "Reject"
   - ✅ Verify rift state updates
   - ✅ Verify seller is notified

---

## 🔄 8. STATE TRANSITION TESTING

### Test Complete Flow

1. **Create Rift**
   - Create rift in `DRAFT` status
   - ✅ Verify status is `DRAFT`

2. **Fund Rift**
   - Buyer funds the rift
   - ✅ Verify status transitions to `FUNDED`

3. **Submit Proof**
   - Seller uploads proof
   - ✅ Verify status transitions to `PROOF_SUBMITTED` or `UNDER_REVIEW`

4. **Approve Proof**
   - Admin approves (or auto-approval if criteria met)
   - ✅ Verify status transitions appropriately

---

## 📝 9. AUDIT LOGGING TESTING

### Test Event Logging

1. **Check All Event Types**
   ```sql
   SELECT DISTINCT eventType FROM vault_events ORDER BY eventType;
   ```
   - ✅ Verify events are logged for:
     - `SELLER_UPLOADED_ASSET`
     - `BUYER_REVEALED_LICENSE_KEY`
     - `BUYER_OPENED_ASSET`
     - `BUYER_DOWNLOADED_FILE`
     - `SYSTEM_QUALITY_CHECK_COMPLETED`
     - `ADMIN_VIEWED_ASSET`

2. **Test Log Chain Integrity**
   - Check that events have proper relationships
   - ✅ Verify `previousEventHash` links correctly
   - ✅ Verify hash chain is intact

---

## 🎯 10. PERFORMANCE TESTING

### Test Large Files

1. **Upload Large File**
   - Upload file close to 50MB limit
   - ✅ Verify upload completes
   - ✅ Verify verification runs

### Test Multiple Assets

1. **Upload Multiple Assets**
   - Upload 5+ assets to same rift
   - ✅ Verify all are processed
   - ✅ Verify verification runs for all

### Test Concurrent Access

1. **Multiple Buyers/Sellers**
   - Test with multiple users accessing same rift
   - ✅ Verify no race conditions
   - ✅ Verify data integrity maintained

---

## ✅ FINAL CHECKLIST

Before considering testing complete:

- [ ] All encryption/decryption tests pass
- [ ] All asset upload validation works
- [ ] All access control checks work
- [ ] Verification pipeline runs correctly
- [ ] State transitions work as expected
- [ ] Buyer access works correctly
- [ ] Admin functions work correctly
- [ ] Error handling is robust
- [ ] Audit logging is comprehensive
- [ ] Performance is acceptable

---

## 📞 SUPPORT

If you encounter issues during testing:

1. Check the console logs for error messages
2. Check the database for data consistency
3. Verify environment variables are set correctly
4. Review the test results document (`TEST_RESULTS.md`)

---

**Last Updated**: 2025-01-22

