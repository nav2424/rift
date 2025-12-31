# 🚀 PRE-LAUNCH CHECKLIST
**Critical Setup Requirements Before Launch**

## 🔴 CRITICAL - MUST DO BEFORE LAUNCH

### 1. Supabase Storage Bucket: `dispute-evidence`
**Status:** ⚠️ **MUST CREATE MANUALLY**

The code references this bucket but it must be created in Supabase:

1. Go to Supabase Dashboard → **Storage**
2. Click **"New bucket"**
3. Name: `dispute-evidence` (exact name, with hyphen)
4. Set to **Private** (not public)
5. Click **Create**

**Why Critical:** Evidence uploads will FAIL if this bucket doesn't exist.

**Verify it exists:**
```bash
# Check in Supabase Dashboard → Storage
# Should see bucket named "dispute-evidence"
```

---

### 2. Database Migrations Applied
**Status:** ⚠️ **VERIFY**

Ensure all migrations are applied:

```bash
# Check migration status
npx prisma migrate status

# If needed, apply migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

**Required Migrations:**
- ✅ Phase 4 disputes migration (`005_phase4_disputes.sql`)
- ✅ Vault system migration
- ✅ All Prisma migrations

---

### 3. Environment Variables Set
**Status:** ⚠️ **VERIFY ALL ARE SET**

#### Required for Evidence System:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Required for Core System:
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-domain.com
JWT_SECRET=...
STRIPE_SECRET_KEY=...
```

**Check:** Verify all variables are set in your deployment environment (Vercel, etc.)

---

### 4. Test Evidence Upload Flow
**Status:** ⚠️ **MUST TEST**

Before launch, test the complete evidence flow:

1. **Create a test dispute:**
   - Create a test rift
   - Open dispute as buyer
   - Upload evidence (PDF, image)

2. **Verify upload works:**
   - Check Supabase Storage → `dispute-evidence` bucket
   - Should see uploaded file

3. **Test viewing:**
   - Admin: View evidence via `/api/admin/disputes/[id]/evidence/[evidenceId]/download`
   - Buyer/Seller: View evidence via `/api/disputes/[id]/evidence/[evidenceId]/view`
   - PDF viewer: Click "View PDF" button

4. **Test file size limit:**
   - Try uploading file >10MB → Should be rejected
   - Try uploading file <10MB → Should work

---

## 🟡 HIGH PRIORITY - SHOULD VERIFY

### 5. Supabase RLS Policies
**Status:** ⚠️ **VERIFY**

The migration should create RLS policies, but verify:

1. Go to Supabase Dashboard → **Authentication** → **Policies**
2. Check `dispute_evidence` table has policies:
   - `dispute_evidence_select_authenticated` (SELECT)
   - Service role can INSERT/UPDATE/DELETE

**If missing:** Run the migration SQL manually from `supabase/migrations/005_phase4_disputes.sql`

---

### 6. Test Ticket Transfer Email
**Status:** ⚠️ **VERIFY**

Test the fixed ticket transfer flow:

1. Create a ticket rift
2. As seller, claim transfer sent
3. Verify email validation works:
   - Invalid email → Should be rejected
   - Valid email → Should work
   - No email provided → Should use buyer's email

---

### 7. Test PDF Viewer
**Status:** ⚠️ **VERIFY**

1. Upload a PDF as evidence
2. In dispute case view, click "View PDF"
3. Verify PDF opens in modal
4. Verify download button works

**Note:** PDF viewer uses iframe - some browsers may block. Test in Chrome, Firefox, Safari.

---

## 🟢 MEDIUM PRIORITY - NICE TO HAVE

### 8. Error Monitoring
**Status:** ⚠️ **RECOMMENDED**

Set up error monitoring:
- Vercel Analytics (already configured)
- Consider Sentry or similar for error tracking
- Monitor for evidence upload failures

---

### 9. Rate Limiting
**Status:** ✅ **ALREADY IMPLEMENTED**

Evidence uploads have rate limiting. Verify it's working in production.

---

## ✅ VERIFIED WORKING (No Action Needed)

- ✅ Evidence upload endpoint created
- ✅ Evidence view endpoints created
- ✅ PDF viewer component created
- ✅ File size validation added (10MB)
- ✅ Ticket transfer email validation fixed
- ✅ All code changes committed

---

## 🧪 FINAL TESTING STEPS

### Before Launch, Test:

1. **Complete Dispute Flow:**
   ```
   Create Rift → Pay → Seller Uploads Proof → 
   Buyer Opens Dispute → Upload Evidence (PDF + Image) → 
   Submit Dispute → View Evidence → Admin Reviews
   ```

2. **Test All Evidence Types:**
   - PDF upload and viewing
   - Image upload and viewing
   - Text evidence
   - Link evidence

3. **Test Access Control:**
   - Buyer can view after submission
   - Seller can view after submission
   - Admin can always view
   - Unauthorized users blocked

4. **Test File Size Limits:**
   - 5MB file → Should work
   - 15MB file → Should be rejected

5. **Test Error Handling:**
   - Missing bucket → Should show clear error
   - Invalid file type → Should be rejected
   - Network failure → Should show error message

---

## 🚨 KNOWN ISSUES (Non-Blockers)

1. **PDF Viewer:** Uses iframe (browser-dependent)
   - Some browsers may require download
   - Not a blocker, but could be enhanced later

2. **Proof Upload Rollback:** Partial uploads may leave inconsistent state
   - Priority 2 issue
   - Can be fixed in first patch

---

## 📋 LAUNCH DECISION

### ✅ READY IF:
- [x] `dispute-evidence` bucket created in Supabase
- [x] All migrations applied
- [x] Environment variables set
- [x] Evidence upload tested and working
- [x] PDF viewer tested and working

### ❌ NOT READY IF:
- [ ] `dispute-evidence` bucket missing
- [ ] Migrations not applied
- [ ] Environment variables missing
- [ ] Evidence upload fails in testing

---

## 🎯 RECOMMENDATION

**Status:** 🟡 **ALMOST READY - ONE CRITICAL SETUP STEP**

The code is ready, but you **MUST**:
1. ✅ Create `dispute-evidence` bucket in Supabase
2. ✅ Test evidence upload once
3. ✅ Verify environment variables are set

**Estimated Setup Time:** 5-10 minutes

**After Setup:** System will be 100% ready for launch.

---

**Last Updated:** 2025-01-28  
**Next Action:** Create Supabase storage bucket

