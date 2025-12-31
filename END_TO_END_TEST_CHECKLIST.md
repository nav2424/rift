# End-to-End Rift Flow Test Checklist

This checklist verifies the complete flow from rift creation to payout processing.

## Prerequisites
- [ ] Two test user accounts (one buyer, one seller)
- [ ] Stripe test mode configured
- [ ] Database seeded with test data
- [ ] Email service configured (or check logs)
- [ ] Cron jobs configured (or trigger manually)

---

## Test Flow 1: Complete Transaction with Manual Release

### Step 1: Create Rift
- [ ] Navigate to `/rifts/new`
- [ ] Select role (Buyer or Seller)
- [ ] Fill in rift details:
  - [ ] Item title
  - [ ] Item description
  - [ ] Item type (DIGITAL, SERVICES, TICKETS, PHYSICAL)
  - [ ] Amount (e.g., $100)
  - [ ] Select partner (buyer/seller)
- [ ] Submit form
- [ ] Verify:
  - [ ] Rift created successfully
  - [ ] Status is `AWAITING_PAYMENT`
  - [ ] Rift appears in buyer's and seller's rift lists
  - [ ] Email notifications sent to both parties
  - [ ] Fees calculated correctly:
    - [ ] `buyerFee` = 3% of subtotal
    - [ ] `sellerFee` = 5% of subtotal
    - [ ] `sellerNet` = subtotal - sellerFee

### Step 2: Buyer Pays
- [ ] As buyer, navigate to rift detail page
- [ ] Click "Pay" button
- [ ] Verify:
  - [ ] Payment intent created
  - [ ] Buyer total = subtotal + 3% (e.g., $103 for $100 subtotal)
  - [ ] Stripe payment form loads
- [ ] Complete payment (use test card)
- [ ] Verify:
  - [ ] Payment confirmed
  - [ ] Status transitions to `FUNDED`
  - [ ] `fundedAt` timestamp set
  - [ ] Timeline event created: "Payment received"
  - [ ] Seller notified (email/notification)

### Step 3: Seller Submits Proof
- [ ] As seller, navigate to rift detail page
- [ ] Submit proof (upload file, enter tracking, etc.)
- [ ] Verify:
  - [ ] Proof submitted successfully
  - [ ] Status transitions to `PROOF_SUBMITTED`
  - [ ] `proofSubmittedAt` timestamp set
  - [ ] Timeline event created
  - [ ] Buyer notified

### Step 4: Buyer Releases Funds
- [ ] As buyer, navigate to rift detail page
- [ ] Click "Release Funds" button
- [ ] Verify:
  - [ ] Status transitions to `RELEASED`
  - [ ] `releasedAt` timestamp set
  - [ ] Seller wallet credited with `sellerNet` amount
  - [ ] Payout record created with `scheduledAt` date
  - [ ] Timeline event created: "Funds released"
  - [ ] User stats updated:
    - [ ] `totalProcessedAmount` incremented
    - [ ] `numCompletedTransactions` incremented
  - [ ] Seller notified (email)

### Step 5: Verify Wallet & Payout
- [ ] Check seller's wallet page
- [ ] Verify:
  - [ ] Available balance increased by `sellerNet` amount
  - [ ] Wallet ledger entry created (type: CREDIT_RELEASE)
- [ ] Check payout record in database:
  - [ ] Status is `PENDING`
  - [ ] `scheduledAt` is set correctly (based on risk tier)
  - [ ] Amount matches `sellerNet`

### Step 6: Process Payout (Manual/Cron)
- [ ] Wait for `scheduledAt` time OR trigger manually
- [ ] Call `/api/payouts/process` endpoint
- [ ] Verify:
  - [ ] Payout status changes to `PROCESSING` or `COMPLETED`
  - [ ] Stripe transfer created (if Stripe Connect configured)
  - [ ] `processedAt` timestamp set
  - [ ] Seller receives funds (check Stripe dashboard)

---

## Test Flow 2: Auto-Release Flow

### Steps 1-3: Same as above (Create, Pay, Submit Proof)

### Step 4: Auto-Release (Wait or Trigger)
- [ ] Wait for `autoReleaseAt` deadline OR trigger manually:
  - [ ] Call `/api/rifts/auto-release` endpoint
- [ ] Verify:
  - [ ] Status transitions to `RELEASED`
  - [ ] All same verifications as manual release (Step 4 above)
  - [ ] Timeline event created: "Funds automatically released"

---

## Test Flow 3: Dispute Resolution

### Steps 1-2: Create and Pay (same as above)

### Step 3: Buyer Raises Dispute
- [ ] As buyer, navigate to rift detail page
- [ ] Click "Raise Dispute" button
- [ ] Submit dispute reason
- [ ] Verify:
  - [ ] Status transitions to `DISPUTED`
  - [ ] Dispute record created
  - [ ] Seller and admin notified

### Step 4: Admin Resolves Dispute
- [ ] As admin, navigate to dispute detail page
- [ ] Review dispute evidence
- [ ] Resolve dispute (Release to Seller OR Refund Buyer)
- [ ] Verify:
  - [ ] If released: Status → `RELEASED`, seller wallet credited
  - [ ] If refunded: Status → `REFUNDED`, buyer refunded
  - [ ] Timeline event created

---

## Test Flow 4: Fee Calculations Verification

### Test with $100 Subtotal
- [ ] Create rift with $100 subtotal
- [ ] Verify calculations:
  - [ ] `buyerFee` = $3.00 (3%)
  - [ ] `sellerFee` = $5.00 (5%)
  - [ ] `sellerNet` = $95.00
  - [ ] Buyer pays: $103.00
- [ ] Complete transaction
- [ ] Verify seller wallet credited with $95.00
- [ ] Verify payout amount is $95.00 (before Stripe fees)

### Test with Different Amounts
- [ ] Test with $50 subtotal
- [ ] Test with $200 subtotal
- [ ] Test with $999.99 subtotal
- [ ] Verify all calculations are correct

---

## Test Flow 5: Different Item Types

### Digital Items
- [ ] Create rift with itemType: DIGITAL
- [ ] Complete full flow
- [ ] Verify auto-release deadline is 48 hours

### Services
- [ ] Create rift with itemType: SERVICES
- [ ] Complete full flow
- [ ] Verify service-specific fields work

### Tickets
- [ ] Create rift with itemType: TICKETS
- [ ] Verify event date and venue fields
- [ ] Complete full flow

---

## Verification Checklist

### Database Verification
- [ ] All timeline events created correctly
- [ ] All status transitions logged
- [ ] Fee fields populated correctly:
  - [ ] `buyerFee`
  - [ ] `sellerFee`
  - [ ] `sellerNet`
  - [ ] `platformFee` (legacy field)
- [ ] Wallet ledger entries created
- [ ] Payout records created with correct amounts

### Email Notifications
- [ ] Rift created email sent
- [ ] Payment received email sent
- [ ] Proof submitted email sent
- [ ] Funds released email sent
- [ ] Payout processed email sent (if applicable)

### UI Verification
- [ ] Fees displayed correctly in UI
- [ ] Buyer sees: subtotal + 3% fee
- [ ] Seller sees: subtotal - 5% fee = net amount
- [ ] Timeline shows correct events
- [ ] Wallet balance updates correctly

### API Verification
- [ ] All endpoints return correct status codes
- [ ] Error handling works correctly
- [ ] Validation prevents invalid states
- [ ] Optimistic locking prevents race conditions

---

## Edge Cases to Test

- [ ] Cancel rift before payment
- [ ] Cancel rift after payment (before proof)
- [ ] Multiple disputes on same rift
- [ ] Auto-release with dispute (should not auto-release)
- [ ] Payout with no Stripe Connect account (should fail gracefully)
- [ ] Concurrent release attempts (optimistic locking)
- [ ] Very small amounts (fee rounding)
- [ ] Very large amounts (overflow protection)

---

## Performance Testing

- [ ] Create 10 rifts simultaneously
- [ ] Process 10 payouts simultaneously
- [ ] Verify no race conditions
- [ ] Check database query performance
- [ ] Verify cron job completes in reasonable time

---

## Security Testing

- [ ] Buyer cannot release funds for someone else's rift
- [ ] Seller cannot access buyer's payment details
- [ ] Unauthorized users cannot access rift details
- [ ] Cron endpoints protected (payout processing)
- [ ] Fee calculations cannot be manipulated

---

## Test Results Template

```
Test Date: __________
Tester: __________
Environment: [ ] Local [ ] Staging [ ] Production

Issues Found:
1. __________
2. __________

All Tests Passed: [ ] Yes [ ] No

Notes:
__________
```

