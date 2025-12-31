# Test Coverage Expansion Plan

This document tracks the comprehensive test coverage expansion requested for the Rift platform.

## ✅ Completed Tests

### 1. Fee Math Invariants (`tests/unit/fee-math-invariants.test.ts`)
- ✅ buyerTotal = subtotal + buyerFee invariant
- ✅ sellerNet = subtotal - sellerFee invariant
- ✅ Rounding rules (2 decimal places, round half up)
- ✅ Currency decimals handling
- ✅ Edge cases (zero, negative, very small/large amounts)
- ✅ Mathematical properties verification
- **Status**: 31 tests, all passing

### 2. Double-Charge Prevention (`tests/security/double-charge-prevention.test.ts`)
- ✅ Payment intent creation idempotency
- ✅ Existing payment intent detection
- ✅ Concurrent creation attempts
- ✅ Status validation before creation
- ✅ Database-level constraint handling
- ✅ Race condition handling
- **Status**: Created, needs integration with actual payment flow

## 🚧 In Progress / To Be Created

### 3. Webhook Ordering (`tests/integration/webhook-ordering.test.ts`)
**Required Tests:**
- [ ] payment_intent.succeeded arrives before DB row exists
- [ ] payment_intent.succeeded arrives after DB row exists
- [ ] Retry storms (same webhook delivered multiple times)
- [ ] Out-of-order events (payment_intent.succeeded before payment_intent.created)
- [ ] Idempotent webhook processing
- [ ] Webhook signature verification
- [ ] Duplicate event detection

### 4. Ledger Never Goes Negative (`tests/unit/ledger-constraints.test.ts`)
**Required Tests:**
- [ ] Wallet balance cannot go below 0
- [ ] Payout cannot exceed available balance
- [ ] Concurrent withdrawal attempts
- [ ] Insufficient balance error handling
- [ ] Balance calculation accuracy
- [ ] Ledger entry atomicity

### 5. Release Idempotency (`tests/integration/release-idempotency.test.ts`)
**Required Tests:**
- [ ] Releasing funds twice doesn't double payout
- [ ] Same for cancel/refund operations
- [ ] State machine prevents duplicate releases
- [ ] Wallet credit idempotency
- [ ] Payout scheduling idempotency

### 6. Stripe Dispute Lifecycle (`tests/integration/stripe-dispute-lifecycle.test.ts`)
**Required Tests:**
- [ ] Stripe dispute opened → rift locked
- [ ] Evidence submission deadlines
- [ ] Stripe dispute won → correct final state (release)
- [ ] Stripe dispute lost → correct final state (refund)
- [ ] Webhook retries don't duplicate stripe_disputes rows
- [ ] Dispute status transitions
- [ ] Evidence due date tracking

### 7. Background Jobs / Cron Reliability (`tests/integration/background-jobs.test.ts`)
**Required Tests:**
- [ ] Job retries are safe (idempotent)
- [ ] Stuck jobs handling (what happens if verification never completes)
- [ ] Clock skew robustness (deadline and auto-release)
- [ ] Exactly-once vs at-least-once handling
- [ ] Job failure recovery
- [ ] Concurrent job execution

### 8. Storage / Vault End-to-End Security (`tests/security/vault-end-to-end.test.ts`)
**Required Tests:**
- [ ] Upload auth: only seller can upload to that rift's folder/bucket key
- [ ] Delete/overwrite prevention: seller cannot replace already-submitted asset
- [ ] Signed URL scope: URL is bound to (riftId, userId, assetId) and cannot be replayed
- [ ] Content-type spoofing: upload .pdf with image mime / polyglots
- [ ] Server-side MIME validation
- [ ] File size limits
- [ ] Malicious file detection

### 9. Admin System Hardening (`tests/security/admin-hardening.test.ts`)
**Required Tests:**
- [ ] Every admin action logs a VaultEvent/AdminReview with immutable chain entry
- [ ] RBAC roles (admin vs support vs reviewer)
- [ ] Least privilege: support can view, but cannot approve/reject/release
- [ ] Audit trail completeness: can reconstruct "who did what" for any rift
- [ ] Admin action authorization checks
- [ ] Immutable log chain verification

### 10. Messaging as Legal Proof (`tests/integration/messaging-legal-proof.test.ts`)
**Required Tests:**
- [ ] Message immutability after transaction funded (editing/deleting disabled or logged)
- [ ] Attachments in chat follow same vault rules
- [ ] Dispute evidence extraction includes relevant chat messages and timestamps
- [ ] Message tampering detection
- [ ] Chat history preservation

### 11. Data Deletion and Account Lifecycle (`tests/integration/data-deletion.test.ts`)
**Required Tests:**
- [ ] User deletes account → what happens to rifts/disputes/logs
- [ ] GDPR soft delete vs hard delete constraints
- [ ] Banned user cannot transact
- [ ] Banned user cannot withdraw
- [ ] Banned user cannot re-register easily
- [ ] Data retention policies

### 12. Rate Limits Beyond Proof (`tests/security/rate-limits-extended.test.ts`)
**Required Tests:**
- [ ] Account creation / verification brute force protection
- [ ] Messaging spam prevention
- [ ] Search endpoints scraping protection
- [ ] Webhook endpoint rate safety
- [ ] Per-IP rate limiting
- [ ] Per-user rate limiting

### 13. Observability and Fail-Closed Behavior (`tests/integration/observability.test.ts`)
**Required Tests:**
- [ ] Missing env vars → app fails fast on boot (not mid-request)
- [ ] External providers down (Stripe/Twilio/Supabase) → graceful errors
- [ ] No partial state commits on external provider failures
- [ ] Request tracing / correlation IDs exist in logs
- [ ] Error logging completeness
- [ ] Health check endpoints

### 14. Multi-Region / Pooler Consistency (`tests/integration/pooler-consistency.test.ts`)
**Required Tests:**
- [ ] Transactions behave correctly with Supabase pooler
- [ ] Long transactions don't break with pooler settings
- [ ] Connection pooling edge cases
- [ ] Transaction isolation levels
- [ ] Locking behavior with pooler

## Implementation Priority

### High Priority (Critical for Production)
1. ✅ Fee Math Invariants
2. ✅ Double-Charge Prevention
3. Webhook Ordering
4. Ledger Never Goes Negative
5. Release Idempotency
6. Stripe Dispute Lifecycle

### Medium Priority (Important for Security)
7. Storage/Vault End-to-End Security
8. Admin System Hardening
9. Background Jobs Reliability
10. Rate Limits Extended

### Lower Priority (Important for Compliance/UX)
11. Messaging as Legal Proof
12. Data Deletion and Account Lifecycle
13. Observability
14. Multi-Region/Pooler Consistency

## Notes

- All tests should use Vitest framework
- Mock external services (Stripe, Supabase, etc.)
- Use factories for test data creation
- Follow existing test patterns in the codebase
- Ensure tests are fast and isolated

## Test Execution

Run all tests:
```bash
npm test -- --run
```

Run specific test file:
```bash
npm test -- --run tests/unit/fee-math-invariants.test.ts
```

