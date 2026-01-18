# Rift Transaction Stages Explained

## Overview

Rift transactions progress through a series of stages (statuses) that represent the lifecycle of an escrow transaction. The system uses a **state machine** to enforce valid transitions between stages.

---

## Primary Status Stages (Current System)

### 1. **DRAFT**
**Description**: Rift has been created but payment has not been made yet.

**What happens**:
- Buyer creates a Rift
- Rift is ready for payment
- No funds are held

**Who can act**:
- **Buyer**: Can pay (→ FUNDED) or cancel (→ CANCELED)
- **Seller**: Can decline/cancel (→ CANCELED)

**Next possible stages**: `FUNDED`, `CANCELED`

---

### 2. **FUNDED** (also called "Paid")
**Description**: Buyer has completed payment. Funds are held in escrow.

**What happens**:
- Payment is confirmed
- Funds are captured and held securely
- Seller can now submit proof of delivery/service

**Who can act**:
- **Seller**: Can submit proof (→ PROOF_SUBMITTED)
- **Buyer**: Can open dispute (→ DISPUTED) or cancel (with seller approval)
- **System/Admin**: Can route to review if risk flags detected (→ UNDER_REVIEW)

**Next possible stages**: `PROOF_SUBMITTED`, `DISPUTED`, `CANCELED`, `UNDER_REVIEW`

---

### 3. **PROOF_SUBMITTED**
**Description**: Seller has submitted proof of delivery/service completion.

**What happens**:
- Seller uploads proof (photos, tracking, completion certificate, etc.)
- Proof is validated (automatically or manually)
- Buyer can review and release funds

**Who can act**:
- **Buyer**: Can release funds (→ RELEASED) or open dispute (→ DISPUTED)
- **Admin/System**: Can route to manual review (→ UNDER_REVIEW) or auto-release
- **Seller**: Can add supplemental proof (stays in PROOF_SUBMITTED)

**Next possible stages**: `UNDER_REVIEW`, `RELEASED`, `DISPUTED`

**Note**: For Service Rifts with milestones, after first milestone release, status resets to `FUNDED` requiring new proof.

---

### 4. **UNDER_REVIEW**
**Description**: Proof requires manual review by admin or automated risk system.

**What happens**:
- Proof flagged for review (risk detection, suspicious activity, etc.)
- Admin reviews proof and evidence
- Can approve, reject, or request more information

**Who can act**:
- **Admin**: Can approve (→ RELEASED), reject (→ PROOF_SUBMITTED), or escalate (→ DISPUTED)
- **Buyer**: Can still release funds early (→ RELEASED) or dispute (→ DISPUTED)
- **Seller**: Can resubmit proof (→ PROOF_SUBMITTED)

**Next possible stages**: `PROOF_SUBMITTED`, `RELEASED`, `DISPUTED`, `CANCELED`

---

### 5. **RELEASED**
**Description**: Funds have been released from escrow to seller's wallet.

**What happens**:
- Buyer released funds (manually or auto-release)
- Funds credited to seller's internal wallet
- Payout to seller's bank account is scheduled

**Who can act**:
- **System**: Automatically schedules payout (→ PAYOUT_SCHEDULED)

**Next possible stages**: `PAYOUT_SCHEDULED`

**Note**: This is the point where seller receives funds in their wallet, but payout to bank may be delayed based on risk tier.

---

### 6. **DISPUTED**
**Description**: Buyer has opened a dispute about the transaction.

**What happens**:
- Buyer files dispute with reason and evidence
- All funds are frozen
- Both parties can submit evidence
- Admin reviews and resolves

**Who can act**:
- **Buyer**: Can submit claims, view seller responses, appeal
- **Seller**: Can submit rebuttal, view buyer claims, appeal
- **Admin**: Can resolve dispute (→ RESOLVED)

**Next possible stages**: `RESOLVED`

**Note**: No funds can be released while in DISPUTED status.

---

### 7. **RESOLVED**
**Description**: Dispute has been resolved by admin.

**What happens**:
- Admin makes final decision
- System processes outcome:
  - Seller wins → Funds released (→ RELEASED or → PAYOUT_SCHEDULED)
  - Buyer wins → Refund processed (→ CANCELED)

**Who can act**:
- **System/Admin**: Processes outcome based on resolution

**Next possible stages**: `RELEASED`, `PAYOUT_SCHEDULED`, `CANCELED`

---

### 8. **PAYOUT_SCHEDULED**
**Description**: Payout to seller's bank account has been scheduled.

**What happens**:
- Funds are queued for bank transfer
- Payout delay applied based on seller's risk tier:
  - **Tier 0**: 5 business days
  - **Tier 1**: 3 business days
  - **Tier 2**: 1 business day
  - **Tier 3**: 1 business day (or instant option)

**Who can act**:
- **System**: Processes payout when delay period expires (→ PAID_OUT)

**Next possible stages**: `PAID_OUT`

---

### 9. **PAID_OUT**
**Description**: Final state - funds have been transferred to seller's bank account.

**What happens**:
- Payout completed via Stripe Connect
- Transaction is complete
- Both parties can view receipt/logs

**Who can act**:
- **Buyer/Seller**: Can view transaction history and receipts

**Next possible stages**: None (terminal state)

---

### 10. **CANCELED**
**Description**: Transaction was canceled before completion.

**What happens**:
- Rift canceled by buyer or seller
- If payment was made, refund is processed
- Transaction ends

**Who can act**:
- None (terminal state)

**Next possible stages**: None (terminal state)

---

## Legacy Status Stages (Backward Compatibility)

These statuses are maintained for backward compatibility but are being phased out in favor of the new system:

### **AWAITING_PAYMENT**
- **Maps to**: `DRAFT`
- **Next stages**: `FUNDED`, `CANCELED`

### **AWAITING_SHIPMENT**
- **Maps to**: `FUNDED`
- **Next stages**: `PROOF_SUBMITTED`, `DISPUTED`

### **IN_TRANSIT**
- **Maps to**: `FUNDED` or `PROOF_SUBMITTED`
- **Next stages**: `PROOF_SUBMITTED`, `RELEASED`, `DISPUTED`

### **DELIVERED_PENDING_RELEASE**
- **Maps to**: `PROOF_SUBMITTED`
- **Next stages**: `RELEASED`, `DISPUTED`

### **REFUNDED**
- **Terminal state** (similar to CANCELED)
- **Next stages**: None

### **CANCELLED**
- **Maps to**: `CANCELED`
- **Next stages**: `CANCELED`

---

## Complete State Flow Diagram

```
DRAFT
  ↓ (Buyer pays)
FUNDED
  ↓ (Seller submits proof)
PROOF_SUBMITTED
  ↓ (Buyer releases OR auto-release)
RELEASED
  ↓ (System schedules payout)
PAYOUT_SCHEDULED
  ↓ (Payout processed)
PAID_OUT ✅ (Terminal)

Alternative paths:
- FUNDED → DISPUTED → RESOLVED → RELEASED/PAYOUT_SCHEDULED/CANCELED
- PROOF_SUBMITTED → UNDER_REVIEW → RELEASED/PROOF_SUBMITTED/DISPUTED
- Any stage → CANCELED (if canceled)
```

---

## Status Transition Rules

### Valid Transitions (from → to)

| From Status | Can Transition To |
|------------|-------------------|
| `DRAFT` | `FUNDED`, `CANCELED` |
| `FUNDED` | `PROOF_SUBMITTED`, `DISPUTED`, `CANCELED`, `UNDER_REVIEW` |
| `PROOF_SUBMITTED` | `UNDER_REVIEW`, `RELEASED`, `DISPUTED` |
| `UNDER_REVIEW` | `PROOF_SUBMITTED`, `RELEASED`, `DISPUTED`, `CANCELED` |
| `RELEASED` | `PAYOUT_SCHEDULED` |
| `DISPUTED` | `RESOLVED` |
| `RESOLVED` | `RELEASED`, `PAYOUT_SCHEDULED`, `CANCELED` |
| `PAYOUT_SCHEDULED` | `PAID_OUT` |
| `PAID_OUT` | None (terminal) |
| `CANCELED` | None (terminal) |

---

## Who Can Perform Actions in Each Stage

### Buyer Actions
- **DRAFT**: Pay, Cancel
- **FUNDED**: Open Dispute, Cancel
- **PROOF_SUBMITTED**: Release Funds, Open Dispute
- **UNDER_REVIEW**: Release Funds, Open Dispute
- **DISPUTED**: Submit Claims, View Responses, Appeal
- **RELEASED/PAID_OUT**: View Receipts

### Seller Actions
- **DRAFT**: Cancel/Decline
- **FUNDED**: Submit Proof
- **PROOF_SUBMITTED**: Add Supplemental Proof
- **UNDER_REVIEW**: Resubmit Proof
- **DISPUTED**: Submit Rebuttal, View Claims, Appeal
- **RELEASED/PAID_OUT**: View Receipts, Check Payout Status

### Admin Actions
- **FUNDED**: Route to Review
- **PROOF_SUBMITTED**: Route to Review, Auto-Release
- **UNDER_REVIEW**: Approve, Reject, Escalate
- **DISPUTED**: Resolve Dispute
- **RESOLVED**: Process Outcome

### System Actions
- **PROOF_SUBMITTED**: Auto-release (after deadline)
- **UNDER_REVIEW**: Auto-approve (low risk)
- **RELEASED**: Schedule Payout
- **PAYOUT_SCHEDULED**: Process Payout (after delay)

---

## Special Cases

### Service Rifts with Milestones
- After **first milestone** is released, status resets to `FUNDED`
- Seller must submit **new proof** for subsequent milestones
- This ensures proof is required for each milestone (unless all funds released at once)

### Auto-Release
- Automatically releases funds after proof deadline expires
- Only works if:
  - Proof is valid
  - No disputes open
  - Buyer hasn't released manually
- Deadline varies by item type (24-48 hours typically)

### Risk-Based Payout Delays
- Payout timing depends on seller's risk tier
- Higher risk = longer delay
- Protects against chargebacks and fraud

---

## Status Indicators in UI

Statuses are displayed with color-coded badges:
- **DRAFT**: Gray/White
- **FUNDED**: Blue
- **PROOF_SUBMITTED**: Yellow/Orange
- **UNDER_REVIEW**: Yellow/Orange
- **RELEASED**: Green
- **DISPUTED**: Red
- **RESOLVED**: Blue/Green
- **PAYOUT_SCHEDULED**: Blue
- **PAID_OUT**: Green (success)
- **CANCELED**: Gray/Red

---

## Summary

The Rift transaction lifecycle follows this general flow:

1. **Creation** → `DRAFT`
2. **Payment** → `FUNDED`
3. **Proof Submission** → `PROOF_SUBMITTED`
4. **Review** (optional) → `UNDER_REVIEW`
5. **Release** → `RELEASED`
6. **Payout** → `PAYOUT_SCHEDULED`
7. **Complete** → `PAID_OUT`

**Alternative paths**:
- Dispute can be opened at any time (→ `DISPUTED` → `RESOLVED`)
- Transaction can be canceled (→ `CANCELED`)
- Auto-release can skip manual review

The state machine ensures transactions progress safely and predictably, protecting both buyers and sellers throughout the process.
