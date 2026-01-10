# Refund & Dispute Stress Test Implementation

## Overview

This document describes the comprehensive refund/dispute handling, idempotency, and balance management system implemented for Rift.

## 1. Refund Policy Enforcement

### Policy: "No Refunds After Release"

**Implementation**: `lib/refund-policy.ts`

- **Full Release**: Once a rift is fully released (`status === 'RELEASED'`), no refunds are allowed
- **Milestone Releases**: If any milestone has been released, only partial refunds for unreleased amounts are allowed
- **Before Release**: Full refunds are allowed if no releases have occurred

### Key Functions

- `checkRefundEligibility(riftId)`: Checks if refund is allowed and calculates max refund amount
- `validateRefundAmount(riftId, amount)`: Validates refund amount against policy

### Usage

```typescript
import { refundRiftPayment } from '@/lib/stripe'

const result = await refundRiftPayment(
  paymentIntentId,
  riftId,
  refundAmount,
  refundRecordId
)

if (result.error) {
  // Policy violation or other error
  console.error(result.error)
}
```

## 2. Idempotency Key Strategy

### Implementation: `lib/stripe-idempotency.ts`

All Stripe operations use stable idempotency keys (no timestamps):

- **PaymentIntent**: `pi:create:rift:{riftId}:v1`
- **Full Release Transfer**: `xfer:release:rift:{riftId}:v1`
- **Milestone Transfer**: `xfer:release:rift:{riftId}:ms:{index}:v1`
- **Refund**: `rfnd:rift:{riftId}:{refundRecordId}:v1`
- **Transfer Reversal**: `xfer:reverse:{transferId}:amt:{cents}:v1`

### Database Idempotency

- **PaymentIntent**: One per rift (enforced by storing `stripePaymentIntentId` in RiftTransaction)
- **Milestone Release**: Unique constraint on `(riftId, milestoneIndex)` prevents duplicate releases
- **Transfer ID**: Stored in `RiftTransaction.stripeTransferId` or `MilestoneRelease.payoutId`

## 3. Balance Availability Checks

### Implementation: `lib/stripe-balance.ts`

Before creating transfers, the system checks Stripe balance availability:

```typescript
import { checkBalanceAvailability } from '@/lib/stripe-balance'

const balance = await checkBalanceAvailability(amount, currency)
if (!balance.sufficient) {
  throw new Error(`Insufficient balance: ${balance.available} ${currency}`)
}
```

### Features

- Checks available balance for the requested currency
- Returns detailed balance information
- Throws error if insufficient (prevents failed transfers)
- Supports waiting for balance with `waitForBalanceAvailability()`

## 4. Concurrency Protection

### Implementation: `lib/release-concurrency.ts`

Prevents duplicate releases using database-level locking:

### Full Release Pattern

1. Check if already released (via `status` and `stripeTransferId`)
2. Use optimistic locking (version field)
3. Create transfer
4. Update with transfer ID

### Milestone Release Pattern

1. Try to create `MilestoneRelease` record with `status='CREATING'`
2. Unique constraint on `(riftId, milestoneIndex)` prevents duplicates
3. If conflict, check if already completed
4. Create transfer
5. Update record with `status='RELEASED'` and `payoutId`

### Key Functions

- `acquireFullReleaseLock(riftId)`: Acquires lock for full release
- `acquireMilestoneReleaseLock(riftId, index)`: Acquires lock for milestone
- `completeReleaseLock(lock, transferId)`: Completes lock with transfer ID
- `releaseFailedLock(lock)`: Cleans up failed lock

## 5. Dispute Freeze Enforcement

### Implementation: `lib/dispute-freeze.ts`

Releases are automatically frozen when disputes exist:

### Checks Performed

1. **Internal Disputes** (Supabase): Checks for disputes with status `submitted`, `needs_info`, `under_review`, `open`
2. **Stripe Disputes**: Checks for disputes with status `needs_response`, `warning_needs_response`, `under_review`
3. **Rift Status**: Checks if rift status is `DISPUTED`

### Usage

```typescript
import { checkDisputeFreeze } from '@/lib/dispute-freeze'

const freezeCheck = await checkDisputeFreeze(riftId)
if (freezeCheck.frozen) {
  throw new Error(freezeCheck.reason)
}
```

### Integration

- `handleRelease()` in `lib/rift-state.ts` checks freeze before releasing
- Milestone release route checks freeze before processing
- Dispute webhooks automatically freeze funds

## 6. Released Amount Tracking

### Current Implementation

- **Full Release**: `RiftTransaction.status === 'RELEASED'` indicates full release
- **Milestone Release**: `MilestoneRelease` records track each milestone release
- **Total Released**: Sum of `MilestoneRelease.releasedAmount` for all released milestones

### Prevention of Over-Release

- Dispute freeze prevents releases when disputes exist
- Concurrency locks prevent duplicate releases
- Balance checks prevent transfers when insufficient funds
- Refund policy prevents refunds after release

## 7. Refund/Dispute Stress Test Scenarios

### Scenario 1: Refund Before Release ✅

**Flow**:
1. Payment succeeds → `status: FUNDED`
2. Refund full amount → Policy allows (no releases)
3. Ensure no transfers allowed afterwards

**Implementation**: `refundRiftPayment()` checks `checkRefundEligibility()` which returns `canRefundFull: true` if no releases.

### Scenario 2: Partial Refund Before Release ✅

**Flow**:
1. Payment succeeds
2. Refund only buyer fee portion
3. Remaining amount can still be released

**Implementation**: `validateRefundAmount()` allows partial refunds up to `maxRefundAmount`.

### Scenario 3: Refund After First Milestone Transfer ⚠️

**Flow**:
1. Payment succeeds
2. First milestone released → Transfer created
3. Attempt refund

**Expected**: Refund rejected (Policy 1: "No refunds after release")

**Implementation**: `checkRefundEligibility()` returns `eligible: false` if any milestones released.

### Scenario 4: Dispute Created While FUNDED ✅

**Flow**:
1. Payment succeeds → `status: FUNDED`
2. Dispute created → Webhook fires
3. Attempt release

**Expected**: Release frozen automatically

**Implementation**: `handleStripeDisputeCreated()` sets `autoReleaseScheduled: false` and `checkDisputeFreeze()` blocks releases.

### Scenario 5: Dispute After Some Releases ✅

**Flow**:
1. Payment succeeds
2. First milestone released
3. Dispute created
4. Attempt second milestone release

**Expected**: Future releases frozen, dispute marked

**Implementation**: `checkDisputeFreeze()` blocks all releases when disputes exist.

### Scenario 6: Dispute Won/Lost ✅

**Flow**:
1. Dispute created → Funds frozen
2. Dispute resolved (won/lost)
3. If won: Re-enable releases
4. If lost: Permanently lock releases

**Implementation**: `handleStripeDisputeClosed()` handles resolution and updates rift status.

## 8. Balance Flow Invariants

### Key Invariants

1. **Never transfer more than eligible**: 
   - Eligible = `sellerPayout` from PaymentIntent metadata
   - For milestones: Proportional to milestone ratio

2. **Avoid balance insufficiency**:
   - `checkBalanceAvailability()` called before every transfer
   - Throws error if insufficient (prevents failed transfers)

3. **Handle pending vs available**:
   - Currently checks `balance.available` only
   - Could be enhanced to wait for pending funds

### Load Test Scenarios

**Simulate**:
- 1,000 rifts funded in 10 minutes
- 5,000 milestone releases over next hour
- Random retries (duplicate requests)
- Random webhook reorder
- Random refunds injected

**Assertions**:
- ✅ No duplicate transfer IDs per milestone (unique constraint)
- ✅ `sum(transfers) <= sum(eligible seller payouts)` (metadata-based)
- ✅ No negative "unreleased" state (policy enforcement)
- ✅ Release blocked when dispute exists (freeze check)
- ✅ Refund policy enforced (eligibility check)

## 9. Evidence Collection for Dispute Prevention

### Current Implementation

- **Buyer Approval Events**: Logged in `rift_events` with `eventType: 'BUYER_CONFIRMED_RECEIPT'`
- **Proof Submission**: Stored in `Proof` table with `status: 'VALID'`
- **Timeline Events**: Created for all major actions
- **Request Metadata**: Captured via `extractRequestMetadata()` (IP, user agent, device fingerprint)

### Recommended Enhancements

1. **Milestone Approval Click Event**:
   - Store: `time`, `buyer_user_id`, `ip`, `user_agent`, `rift_id`, `milestone_index`
   - Use for Stripe dispute evidence

2. **Proof Hash Storage**:
   - Store hash of proof payload for immutability
   - Reference in dispute evidence

3. **Communication Logs**:
   - Store in-app message references
   - Include in dispute evidence package

## 10. Dispute Fee Minimization

### Current Measures

1. **Evidence-First Design**: 
   - Proof submission required before release
   - Buyer confirmation events logged
   - Timeline events capture all actions

2. **Freeze Funds at First Sign of Risk**:
   - Dispute webhook instantly freezes releases
   - Payment failed webhook locks and notifies

3. **Clear Statement Descriptor**:
   - PaymentIntent description: `Rift payment for transaction {riftId}`
   - Receipt email sent immediately

4. **3DS/Radar**:
   - Can be enabled selectively for high-risk transactions
   - Currently not implemented (can be added)

### Recommended Enhancements

1. **In-App Resolution Flow**:
   - Add "Request resolution" with 24-48h window
   - Make it obvious and fast
   - Prevents buyers from going to Stripe

2. **Risk-Based Freezing**:
   - Freeze on buyer account age < X days
   - Freeze on first-time buyer + high amount
   - Freeze on billing country mismatch

## Files Modified

1. `lib/stripe.ts` - Added idempotency keys, balance checks, refund policy
2. `lib/stripe-idempotency.ts` - Idempotency key generation
3. `lib/stripe-balance.ts` - Balance availability checking
4. `lib/refund-policy.ts` - Refund policy enforcement
5. `lib/release-concurrency.ts` - Concurrency protection
6. `lib/dispute-freeze.ts` - Dispute freeze enforcement
7. `lib/rift-state.ts` - Updated `handleRelease()` with freeze checks
8. `app/api/rifts/[id]/milestones/[index]/release/route.ts` - Added concurrency protection
9. `app/api/admin/rifts/[riftId]/resolve-dispute/route.ts` - Updated to use new refund function

## Testing Checklist

- [ ] Refund before release (full)
- [ ] Refund before release (partial)
- [ ] Refund after milestone release (should fail)
- [ ] Refund after full release (should fail)
- [ ] Dispute created before release (freeze check)
- [ ] Dispute created after milestone (freeze check)
- [ ] Concurrent release attempts (idempotency)
- [ ] Balance insufficient (error handling)
- [ ] Duplicate milestone release (unique constraint)
- [ ] Webhook reordering (idempotency keys)




