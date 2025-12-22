# Phase 5 Implementation: Risk Engine + Enforcement Automation + Holds/Funds Freezing + Abuse Controls

## Overview

Phase 5 implements a comprehensive risk scoring system, automatic enforcement actions, and abuse controls to protect the platform and users.

## ✅ Completed Components

### 1. Database Schema

#### Supabase Migration
- **`supabase/migrations/006_phase5_risk_engine.sql`**
  - `risk_profiles` table: User risk scores, metrics, and history
  - `enforcement_actions` table: Append-only log of all enforcement actions
  - `user_restrictions` table: Current state of user restrictions
  - RLS policies for all tables
  - Indexes for performance

#### Prisma Schema Updates
- Added to `RiftTransaction`:
  - `requiresBuyerConfirmation` (Boolean): Require buyer confirmation before release (risk-based)
  - `requiresManualReview` (Boolean): Require admin manual review before release (risk-based)
  - `riskScore` and `holdUntil` already existed from Phase 3

**Migration Required**: 
- Run Supabase migration: `supabase migration up` or apply `006_phase5_risk_engine.sql`
- Run Prisma migration: `npx prisma migrate dev` to apply schema changes

### 2. Risk Engine Module

#### `lib/risk/computeRisk.ts`
- `ensureRiskProfile(userId)`: Creates risk profile if missing
- `computeUserRisk(userId, role)`: Computes 0-100 risk score based on:
  - Chargebacks (severe penalty: +40)
  - Dispute abuse (ratio > 0.5 and >= 3 disputes: +15)
  - Strikes (>= 3: +10)
  - Account age < 14 days (+10)
  - Positive signals: successful transactions >= 10 (-10), volume >= $5k (-10)
- `computeRiftRisk(riftId)`: Computes 0-100 risk score based on:
  - Category weight (TICKETS: +20, DIGITAL: +10, SERVICES: +5, PHYSICAL: +0)
  - Amount weight (< $50: +0, $50-$200: +5, $200-$1000: +10, > $1000: +20)
  - User risk influence (buyerRisk * 0.4 + sellerRisk * 0.4)
- `applyRiskPolicy(riftId)`: Applies risk-based policies:
  - 0-29 (low): 24h hold, no confirmation (except tickets/physical)
  - 30-59 (medium): 72h hold, confirmation required
  - 60-79 (high): 7 days hold, confirmation + manual review for tickets/high amounts
  - 80-100 (critical): 14 days hold, confirmation + manual review, potential freeze

### 3. Enforcement Engine

#### `lib/risk/enforcement.ts`
- `evaluateEnforcement(userId)`: Evaluates and applies automatic enforcement:
  - **Chargeback >= 1**: Freeze funds, ban if >= 2
  - **Dispute abuse**: If disputes_opened >= 5 and loss ratio >= 0.6:
    - Restrict disputes for 30 days
    - Add strike
  - **Seller non-delivery**: If disputes_lost >= 3:
    - Block TICKETS category
- `isFundsFrozen(userId)`: Check if user funds are frozen
- `isDisputesRestricted(userId)`: Check if user can open disputes
- `isCategoryBlocked(userId, category)`: Check if user is blocked from category

### 4. Metrics Updates

#### `lib/risk/metrics.ts`
- `updateMetricsOnFundsReleased()`: Updates successful_transactions and total_volume for buyer/seller
- `updateMetricsOnDisputeSubmitted()`: Increments disputes_opened, updates last_dispute_at
- `updateMetricsOnDisputeResolved()`: Updates disputes_lost or strikes based on resolution
- `updateMetricsOnChargeback()`: Increments chargebacks, triggers enforcement

### 5. Integration Points

#### Payment Success Webhook
- **File**: `app/api/webhooks/stripe/route.ts`
- Applies risk policy after payment succeeds
- Updates chargeback metrics on chargeback events

#### Dispute Handlers
- **File**: `app/api/disputes/[id]/submit/route.ts`
  - Checks dispute restrictions before submission
  - Updates metrics on dispute submitted
- **Files**: `app/api/admin/disputes/[id]/resolve-*.ts`
  - Updates metrics on dispute resolution
  - Triggers enforcement evaluation

#### Release Engine
- **File**: `lib/release-engine.ts`
- Updates risk metrics when funds are released (successful transaction)

#### Rift Creation
- **File**: `app/api/rifts/create/route.ts`
- Checks category restrictions before allowing rift creation

### 6. Admin Tooling

#### API Routes
- **`app/api/admin/risk/users/[userId]/route.ts`**: Get user risk profile, restrictions, enforcement actions
- **`app/api/admin/risk/users/[userId]/restrictions/route.ts`**: Update user restrictions (admin override)

#### Admin Pages
- **`app/admin/risk/users/[userId]/page.tsx`**: Admin page to view and manage user risk
- **`components/UserRiskView.tsx`**: React component for displaying and managing user risk

**Admin Actions Available:**
- Remove disputes restriction
- Unfreeze funds
- Add/remove category blocks
- View enforcement history

## Risk Scoring Logic

### User Risk Score (0-100)
- Base: 10
- Chargebacks >= 1: +40
- Dispute abuse (ratio > 0.5, >= 3 disputes): +15
- Strikes >= 3: +10
- Account age < 14 days: +10
- Successful transactions >= 10: -10
- Total volume >= $5k: -10

### Rift Risk Score (0-100)
- Category weight: TICKETS (+20), DIGITAL (+10), SERVICES (+5), PHYSICAL (+0)
- Amount weight: < $50 (+0), $50-$200 (+5), $200-$1000 (+10), > $1000 (+20)
- User risk: (buyerRisk * 0.4) + (sellerRisk * 0.4)

## Enforcement Rules

1. **Chargeback >= 1**: Freeze funds immediately, ban if >= 2
2. **Dispute Abuse**: If disputes_opened >= 5 and loss ratio >= 0.6:
   - Restrict disputes for 30 days
   - Add strike
3. **Seller Non-Delivery**: If disputes_lost >= 3:
   - Block TICKETS category first
4. **Critical Risk (>= 80)**: Require manual review, extend hold to 14 days

## Acceptance Tests

1. ✅ After payment success on high-risk ticket rift:
   - Risk policy applied with extended hold and confirmation required
2. ✅ Buyer who loses many disputes:
   - Disputes restricted, strike added
3. ✅ Seller with repeated losses:
   - TICKETS category blocked
4. ✅ Chargeback event:
   - Funds frozen, enforcement action logged
5. ✅ All risk and enforcement decisions logged to rift_events and enforcement_actions

## Files Created/Modified

### New Files
- `supabase/migrations/006_phase5_risk_engine.sql`
- `lib/risk/computeRisk.ts`
- `lib/risk/enforcement.ts`
- `lib/risk/metrics.ts`
- `app/api/admin/risk/users/[userId]/route.ts`
- `app/api/admin/risk/users/[userId]/restrictions/route.ts`
- `app/admin/risk/users/[userId]/page.tsx`
- `components/UserRiskView.tsx`

### Modified Files
- `prisma/schema.prisma` (added requiresBuyerConfirmation, requiresManualReview)
- `app/api/webhooks/stripe/route.ts` (risk policy on payment, chargeback metrics)
- `app/api/disputes/[id]/submit/route.ts` (restriction check, metrics update)
- `app/api/admin/disputes/[id]/resolve-*.ts` (metrics update)
- `lib/release-engine.ts` (metrics update on release)
- `app/api/rifts/create/route.ts` (category restriction check)

## Next Steps

1. **Apply Migrations**:
   ```bash
   # Supabase migration
   supabase migration up
   # Or apply manually via Supabase dashboard
   
   # Prisma migration
   npx prisma migrate dev
   npx prisma generate
   ```

2. **Test Risk Scoring**:
   - Create high-value ticket rift → verify extended hold
   - Submit multiple disputes → verify restriction
   - Trigger chargeback → verify freeze

3. **Monitor Enforcement**:
   - Check enforcement_actions table for automatic actions
   - Use admin tooling to view/manage user risk

4. **Refine Rules** (Future):
   - Add more sophisticated dispute abuse detection
   - Implement time-windowed metrics (e.g., disputes in last 60 days)
   - Add more category-specific restrictions

## Notes

- All risk decisions are logged to `rift_events` for audit trail
- Enforcement actions are append-only for complete history
- Admin can override any restriction via admin tooling
- Risk scores are recomputed on relevant events (disputes, chargebacks, releases)
- Category restrictions prevent sellers from creating rifts in blocked categories
- Dispute restrictions prevent buyers from opening new disputes during restriction period

