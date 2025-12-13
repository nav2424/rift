# Rift Transaction Business Model - Implementation Guide

## Overview

This implementation provides a complete transaction business model for Rift with:
- 3% buyer fee + 5% seller fee structure
- Strict state machine for transaction lifecycle
- Internal wallet/ledger system
- Risk-based payout delays
- Proof validation system
- Dispute resolution flows
- Stripe Connect integration

## Database Migration

Run the migration to apply all schema changes:

```bash
npx prisma migrate deploy
# or for development:
npx prisma migrate dev
```

The migration file is located at: `prisma/migrations/20251212000000_add_rift_business_model/migration.sql`

## Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron Jobs (optional, for background processing)
CRON_SECRET=your-secret-key-here

# Database
DATABASE_URL=postgresql://...
```

## State Machine

### Valid States

- **DRAFT**: Rift created, not yet funded
- **FUNDED**: Buyer paid, funds captured
- **PROOF_SUBMITTED**: Seller submitted proof (validated)
- **UNDER_REVIEW**: Proof requires manual review
- **RELEASED**: Funds released to seller wallet
- **DISPUTED**: Buyer opened dispute
- **RESOLVED**: Dispute resolved by admin
- **PAYOUT_SCHEDULED**: Bank payout scheduled
- **PAID_OUT**: Payout sent to seller
- **CANCELED**: Rift canceled/expired

### State Transitions

See `lib/state-machine.ts` for complete transition rules.

## API Endpoints

### Rift Management

- `POST /api/escrows` - Create rift (DRAFT)
- `POST /api/escrows/[id]/fund` - Fund rift (DRAFT → FUNDED)
- `PUT /api/escrows/[id]/fund` - Confirm payment
- `POST /api/escrows/[id]/proof` - Submit proof (FUNDED → PROOF_SUBMITTED/UNDER_REVIEW)
- `POST /api/escrows/[id]/release` - Release funds (PROOF_SUBMITTED → RELEASED)
- `POST /api/escrows/[id]/dispute` - Open dispute (FUNDED/PROOF_SUBMITTED → DISPUTED)

### Wallet

- `GET /api/wallet` - Get wallet balance and ledger
- `POST /api/wallet/withdraw` - Request withdrawal

### Admin

- `POST /api/admin/escrows/[id]/resolve-dispute` - Resolve dispute
  - Resolution types: `FULL_RELEASE`, `PARTIAL_REFUND`, `FULL_REFUND`

### Background Jobs

- `POST /api/escrows/auto-release` - Process auto-releases (cron)
- `POST /api/payouts/process` - Process scheduled payouts (cron)

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook handler

## Fee Structure

- **Buyer Fee**: 3% of subtotal (payment processing & card network fee)
- **Seller Fee**: 5% of subtotal (Rift platform fee)
- **Buyer Pays**: subtotal + buyerFee
- **Seller Receives**: subtotal - sellerFee (net)

Example:
- Subtotal: $100
- Buyer Fee: $3 (3%)
- Seller Fee: $5 (5%)
- Buyer Pays: $103
- Seller Receives: $95

## Risk Tiers & Payout Delays

### Tier Calculation

- **TIER0_NEW**: <2 completed rifts OR account age < 7 days OR not verified → 5 business days
- **TIER1_NORMAL**: verified + >=2 completed → 3 business days
- **TIER2_TRUSTED**: verified + >=10 completed + account age >=30 days + 0 chargebacks/disputes → 1 business day
- **TIER3_PRO**: Manual approval → 1 business day (instant option available)

### High-Risk Categories

Tickets and digital items have minimum 3 business days delay (unless Tier 3 + instant payout).

## Proof Validation

### Proof Types

- **PHYSICAL**: Requires tracking number + carrier
- **SERVICE**: Requires completion confirmation or message log
- **DIGITAL**: Requires file hash or access credential delivery log

Proofs are automatically validated with basic checks. Invalid proofs go to UNDER_REVIEW for manual validation.

## Wallet System

### Wallet Account

Each user has a wallet account with:
- `availableBalance`: Funds available for withdrawal
- `pendingBalance`: Funds pending release

### Ledger Entries

All wallet transactions are recorded in immutable ledger entries:
- `CREDIT_RELEASE`: Funds released from rift
- `DEBIT_WITHDRAWAL`: Withdrawal to bank
- `DEBIT_CHARGEBACK`: Chargeback debit
- `DEBIT_REFUND`: Refund debit
- `ADJUSTMENT`: Manual adjustment

## Dispute Resolution

### Resolution Types

1. **FULL_RELEASE**: Release funds to seller (normal flow)
2. **PARTIAL_REFUND**: Refund buyer part, release remainder to seller
3. **FULL_REFUND**: Full refund to buyer, seller gets nothing

## Stripe Integration

### Payment Flow

1. Create PaymentIntent with buyer total (subtotal + buyer fee)
2. Capture payment on confirmation
3. Store charge ID for chargeback tracking

### Payout Flow

1. On RELEASED, credit seller wallet
2. Schedule payout based on risk tier
3. Process payout via Stripe Transfer to connected account

### Webhooks Handled

- `payment_intent.succeeded` → Transition to FUNDED
- `payment_intent.payment_failed` → Log failure
- `charge.dispute.created` → Debit seller wallet, lock payouts if negative
- `transfer.paid` → Mark payout as completed
- `transfer.failed` → Mark payout as failed, refund wallet
- `account.updated` → Update verification status

## Background Jobs

### Auto-Release

Runs periodically to auto-release funds after review window:
- Default: 72 hours after proof submitted
- Tickets/Digital: 48 hours
- Only if no open disputes

### Payout Processing

Runs periodically to process scheduled payouts:
- Checks for payouts with `scheduledAt <= now`
- Processes via Stripe Transfer
- Updates payout status

### Cron Setup

For production, set up cron jobs:

```bash
# Auto-release (every hour)
0 * * * * curl -X POST https://your-domain.com/api/escrows/auto-release -H "Authorization: Bearer $CRON_SECRET"

# Payout processing (every 6 hours)
0 */6 * * * curl -X POST https://your-domain.com/api/payouts/process -H "Authorization: Bearer $CRON_SECRET"
```

Or use Vercel Cron (add to `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/escrows/auto-release",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/payouts/process",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## Seller Verification

Sellers must complete verification before withdrawing:
1. Email verified
2. Phone verified
3. Stripe Connect account created
4. Stripe Identity verification completed

## Testing

### Test Flow

1. Create rift (DRAFT)
2. Fund rift (FUNDED)
3. Submit proof (PROOF_SUBMITTED)
4. Auto-release or manual release (RELEASED)
5. Wallet credited
6. Payout scheduled
7. Payout processed (PAID_OUT)

### Test Dispute Flow

1. Create and fund rift
2. Open dispute (DISPUTED)
3. Admin resolves (FULL_RELEASE/PARTIAL_REFUND/FULL_REFUND)
4. Funds released or refunded accordingly

## Important Notes

1. **Optimistic Locking**: Rift transactions use version field to prevent race conditions
2. **Idempotency**: All webhook handlers and jobs are idempotent
3. **Wallet Integrity**: All wallet operations use database transactions
4. **State Validation**: All state transitions are validated before execution
5. **Fee Calculation**: Fees are calculated at creation and stored in rift record

## Next Steps

1. Run migration: `npx prisma migrate deploy`
2. Set up Stripe webhook endpoint
3. Configure cron jobs
4. Test complete flow
5. Update UI components to use new endpoints
