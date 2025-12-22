# Rift Codebase Analysis - Critical Issues & Improvements

## 🔴 CRITICAL ISSUES

### 1. **Dual Status System - Major Inconsistency**

**Problem:** The codebase uses TWO parallel status systems that conflict:

- **Old System:** `AWAITING_PAYMENT` → `AWAITING_SHIPMENT` → `IN_TRANSIT` → `DELIVERED_PENDING_RELEASE` → `RELEASED`
- **New System:** `DRAFT` → `FUNDED` → `PROOF_SUBMITTED` → `UNDER_REVIEW` → `RELEASED`

**Impact:**
- `lib/payments.ts` sets status to `AWAITING_SHIPMENT` (line 44)
- Webhook handler sets status to `FUNDED` (webhook route)
- `lib/rules.ts` only validates old status transitions
- `lib/state-machine.ts` has both but they're not aligned
- UI components check for both statuses inconsistently

**Files Affected:**
- `lib/payments.ts:44` - Sets `AWAITING_SHIPMENT`
- `lib/rules.ts` - Only validates old statuses
- `app/api/escrows/[id]/upload-shipment-proof/route.ts:41` - Checks `canTransition` with old status
- `app/dashboard/page.tsx` - Checks both status sets
- `components/EscrowActions.tsx` - Mixed status checks

**Fix Required:**
1. Choose ONE status system (recommend new: FUNDED, PROOF_SUBMITTED, UNDER_REVIEW)
2. Migrate all old statuses to new ones
3. Update `lib/rules.ts` to handle new statuses
4. Update all API routes to use new statuses
5. Update all UI components

---

### 2. **Amount vs Subtotal Confusion**

**Problem:** The schema has both `amount` (legacy) and `subtotal` (new), but code inconsistently uses both.

**Impact:**
- `prisma/schema.prisma:143-174` - Both fields exist
- Code uses `rift.amount ?? rift.subtotal` everywhere (defensive but confusing)
- Fee calculations use `subtotal` but some code still references `amount`
- Payment processing uses `amount` field

**Files Affected:**
- `app/api/escrows/[id]/release-funds/route.ts:76` - Uses `rift.amount ?? 0`
- `app/api/escrows/[id]/confirm-received/route.ts:123` - Uses `rift.amount ?? 0`
- `lib/payments.ts:49` - Uses `rift.amount ?? rift.subtotal`
- `app/dashboard/page.tsx:155` - Uses `(e as any).subtotal || e.amount || 0`

**Fix Required:**
1. Remove `amount` field from schema (migrate data first)
2. Update all code to use `subtotal` exclusively
3. Update fee calculations to always use `subtotal`

---

### 3. **State Machine Validation Gaps**

**Problem:** `lib/rules.ts` doesn't handle new status transitions properly.

**Current Issues:**
- `canTransition()` function only validates old status system
- No validation for `FUNDED` → `PROOF_SUBMITTED`
- No validation for `PROOF_SUBMITTED` → `UNDER_REVIEW`
- No validation for `UNDER_REVIEW` → `RELEASED`

**Files Affected:**
- `lib/rules.ts:7-66` - Missing new status transitions
- `lib/state-machine.ts:8-26` - Has new transitions but `rules.ts` doesn't use them

**Fix Required:**
1. Update `lib/rules.ts` to handle all new statuses
2. Align `rules.ts` with `state-machine.ts`
3. Remove old status handling or create migration path

---

### 4. **Payment Flow Inconsistency**

**Problem:** Payment processing sets wrong status and doesn't align with webhook.

**Current Flow:**
1. User creates payment intent → Status: `DRAFT` or `AWAITING_PAYMENT`
2. Payment succeeds (webhook) → Status: `FUNDED` ✅
3. But `processPayment()` sets → Status: `AWAITING_SHIPMENT` ❌

**Files Affected:**
- `lib/payments.ts:44` - Sets `AWAITING_SHIPMENT` instead of `FUNDED`
- `app/api/webhooks/stripe/route.ts:126` - Sets `FUNDED` correctly
- `app/api/escrows/[id]/mark-paid/route.ts` - Uses `processPayment()` which sets wrong status

**Fix Required:**
1. Update `processPayment()` to set `FUNDED` status
2. Remove `AWAITING_SHIPMENT` status setting
3. Ensure webhook and manual payment both set `FUNDED`

---

### 5. **Fee Calculation Using Wrong Field**

**Problem:** Fee calculations sometimes use `amount` (legacy) instead of `subtotal`.

**Files Affected:**
- `app/api/escrows/[id]/release-funds/route.ts:76` - `getFeeBreakdown(rift.amount ?? 0)`
- `app/api/escrows/[id]/confirm-received/route.ts:123` - `getFeeBreakdown(updatedEscrow.amount ?? 0)`
- Should use `rift.subtotal` instead

**Fix Required:**
1. Update all fee calculations to use `subtotal`
2. Remove fallback to `amount` field

---

## 🟡 HIGH PRIORITY ISSUES

### 6. **Missing Authorization Checks**

**Potential Issues:**
- Some routes may not verify user is buyer/seller before actions
- Admin routes may not verify admin role properly

**Files to Review:**
- `app/api/escrows/[id]/cancel/route.ts` - Verify user is buyer
- `app/api/admin/*` - Verify admin role
- `app/api/escrows/[id]/raise-dispute/route.ts` - Verify user is buyer

**Fix Required:**
1. Audit all API routes for proper authorization
2. Add role checks where missing
3. Add integration tests for authorization

---

### 7. **Inconsistent Error Handling**

**Problem:** Error handling is inconsistent across routes.

**Issues:**
- Some routes return generic "Internal server error"
- Some routes log errors, some don't
- Error messages not user-friendly
- No error tracking/monitoring

**Fix Required:**
1. Standardize error response format
2. Add structured logging
3. Implement error tracking (Sentry, etc.)
4. Return user-friendly error messages

---

### 8. **Database Schema Legacy Fields**

**Problem:** Schema has deprecated fields that should be removed.

**Legacy Fields:**
- `EscrowTransaction.amount` (use `subtotal`)
- `EscrowTransaction.platformFee` (use `sellerFee`)
- `EscrowTransaction.sellerPayoutAmount` (use `sellerNet`)
- `User.availableBalance` and `User.pendingBalance` (use `WalletAccount`)

**Fix Required:**
1. Create migration to remove legacy fields
2. Update all code references
3. Add data migration if needed

---

### 9. **Proof Submission Status Mismatch**

**Problem:** Proof submission uses old status (`IN_TRANSIT`) instead of new (`PROOF_SUBMITTED`).

**Files Affected:**
- `app/api/escrows/[id]/upload-shipment-proof/route.ts:142` - Sets `IN_TRANSIT`
- Should set `PROOF_SUBMITTED` for new system
- `lib/state-machine.ts:11` - Expects `PROOF_SUBMITTED` from `FUNDED`

**Fix Required:**
1. Update proof submission to set `PROOF_SUBMITTED`
2. Update state machine validation
3. Update UI to reflect new status

---

### 10. **Auto-Release Status Check**

**Problem:** Auto-release checks for `PROOF_SUBMITTED` and `UNDER_REVIEW`, but proof submission sets `IN_TRANSIT`.

**Files Affected:**
- `lib/auto-release.ts:31` - Checks for `PROOF_SUBMITTED` or `UNDER_REVIEW`
- `app/api/escrows/[id]/upload-shipment-proof/route.ts:142` - Sets `IN_TRANSIT`

**Fix Required:**
1. Align proof submission with auto-release expectations
2. Update status transitions consistently

---

## 🟢 MEDIUM PRIORITY IMPROVEMENTS

### 11. **Code Duplication**

**Issues:**
- Fee calculation logic duplicated in multiple files
- Status validation duplicated
- User role checking duplicated

**Fix Required:**
1. Extract common logic to utility functions
2. Create shared validation functions
3. Reduce duplication

---

### 12. **Type Safety Issues**

**Issues:**
- Many `as any` type assertions
- Missing TypeScript types for API responses
- Prisma client types not always used

**Files with `as any`:**
- `app/api/escrows/[id]/release-funds/route.ts:138`
- `app/dashboard/page.tsx:155` (multiple)
- `lib/activity.ts:27`

**Fix Required:**
1. Add proper TypeScript types
2. Remove `as any` assertions
3. Use Prisma generated types

---

### 13. **Missing Input Validation**

**Issues:**
- Some API routes don't validate input thoroughly
- No schema validation (Zod, Yup, etc.)
- Missing validation for edge cases

**Fix Required:**
1. Add input validation library (Zod recommended)
2. Validate all API inputs
3. Add validation for edge cases

---

### 14. **Inconsistent Naming**

**Issues:**
- Mix of `rift` and `rift` terminology
- Inconsistent variable naming
- Some functions use `transaction`, others use `rift`

**Fix Required:**
1. Standardize terminology (recommend "rift")
2. Update all variable names
3. Update documentation

---

### 15. **Missing Tests**

**Issues:**
- No unit tests
- No integration tests
- No E2E tests
- Critical flows untested

**Fix Required:**
1. Add unit tests for utility functions
2. Add integration tests for API routes
3. Add E2E tests for critical flows
4. Set up CI/CD with test coverage

---

## 📋 RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Week 1-2)
1. ✅ Fix status system inconsistency (choose one system)
2. ✅ Fix payment flow to use correct status
3. ✅ Update state machine validation
4. ✅ Fix fee calculations to use `subtotal`

### Phase 2: High Priority (Week 3-4)
5. ✅ Remove legacy `amount` field
6. ✅ Fix proof submission status
7. ✅ Add missing authorization checks
8. ✅ Standardize error handling

### Phase 3: Improvements (Week 5-6)
9. ✅ Add input validation
10. ✅ Improve type safety
11. ✅ Reduce code duplication
12. ✅ Add comprehensive tests

---

## 🔍 SPECIFIC CODE FIXES NEEDED

### Fix 1: Update `lib/payments.ts`
```typescript
// Change line 44 from:
status: 'AWAITING_SHIPMENT',
// To:
status: 'FUNDED',
```

### Fix 2: Update `lib/rules.ts`
Add new status transitions:
```typescript
case 'FUNDED':
  if (actorRole === 'SELLER') {
    return newStatus === 'PROOF_SUBMITTED'
  }
  return false

case 'PROOF_SUBMITTED':
  if (actorRole === 'BUYER') {
    return newStatus === 'RELEASED' || newStatus === 'DISPUTED'
  }
  if (actorRole === 'ADMIN') {
    return newStatus === 'UNDER_REVIEW' || newStatus === 'RELEASED'
  }
  return false

case 'UNDER_REVIEW':
  if (actorRole === 'BUYER') {
    return newStatus === 'RELEASED' || newStatus === 'DISPUTED'
  }
  return false
```

### Fix 3: Update `app/api/escrows/[id]/upload-shipment-proof/route.ts`
```typescript
// Change line 142 from:
status: 'IN_TRANSIT',
// To:
status: 'PROOF_SUBMITTED',
```

### Fix 4: Update fee calculations
Replace all instances of:
```typescript
getFeeBreakdown(rift.amount ?? 0)
// With:
getFeeBreakdown(rift.subtotal)
```

---

## 📊 METRICS & MONITORING

### Missing Monitoring
- No error tracking (Sentry, etc.)
- No performance monitoring
- No business metrics tracking
- No user analytics

### Recommended Additions
1. Error tracking (Sentry)
2. Performance monitoring (Vercel Analytics)
3. Business metrics (transaction volume, success rate)
4. User analytics (Mixpanel, PostHog)

---

## 🚨 SECURITY CONCERNS

### Potential Issues
1. **JWT Secret:** Check if using default secret in production
2. **API Rate Limiting:** No rate limiting on API routes
3. **Input Sanitization:** Need to verify all inputs are sanitized
4. **SQL Injection:** Using Prisma (safe), but verify all queries
5. **File Uploads:** Verify file upload security (size limits, type validation)

### Recommendations
1. Add rate limiting middleware
2. Add input sanitization
3. Add file upload validation
4. Security audit of all API routes
5. Add CORS configuration

---

## 📝 DOCUMENTATION GAPS

### Missing Documentation
1. API documentation (OpenAPI/Swagger)
2. Architecture diagrams
3. Deployment guide
4. Database schema documentation
5. State machine flow diagrams

### Recommended Additions
1. API documentation with examples
2. Architecture decision records (ADRs)
3. Deployment runbooks
4. Database migration guide
5. State machine documentation

---

## ✅ POSITIVE ASPECTS

### What's Working Well
1. ✅ Good separation of concerns (lib/ folder structure)
2. ✅ TypeScript usage throughout
3. ✅ Prisma for database (type-safe)
4. ✅ Comprehensive feature set
5. ✅ Mobile + Web support
6. ✅ Stripe integration
7. ✅ Email notifications
8. ✅ Activity feed system
9. ✅ Wallet system with ledger
10. ✅ Risk tier system

---

## 🎯 PRIORITY SUMMARY

**Must Fix Immediately:**
1. Status system inconsistency
2. Payment flow status
3. Fee calculation field usage

**Should Fix Soon:**
4. State machine validation
5. Proof submission status
6. Legacy field removal

**Nice to Have:**
7. Tests
8. Documentation
9. Monitoring
10. Code quality improvements
