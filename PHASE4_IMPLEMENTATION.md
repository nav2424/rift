# Phase 4 Implementation: High-friction Disputes + Auto-triage + Admin Review Queue

## Overview

Phase 4 implements a comprehensive dispute system with high-friction entry, objective auto-triage, and full admin review capabilities.

## ✅ Completed Components

### 1. Database Schema

#### Supabase Migration
- **`supabase/migrations/005_phase4_disputes.sql`**
  - `disputes` table: Core dispute records with status, reason, sworn declaration, auto-triage results
  - `dispute_evidence` table: Evidence files and text entries
  - `dispute_actions` table: Complete audit trail of all dispute actions
  - RLS policies for all tables
  - Indexes for performance

**Storage Bucket Required**: Create `dispute-evidence` bucket in Supabase Storage (private).

### 2. Auto-Triage Engine

#### `lib/dispute-auto-triage.ts`
- `autoTriageDispute(riftId, reason, category)`: Analyzes objective signals
- `checkAbuseRisk(userId)`: Checks for excessive disputes

**Auto-Reject Rules:**
- **Digital Goods**: Downloaded OR viewed 30+ seconds → auto-reject "not_received"
- **Services**: Buyer confirmed completion → auto-reject most reasons
- **Tickets**: Event passed OR buyer confirmed receipt → auto-reject "not_received"

### 3. Dispute Wizard UI

#### `components/DisputeWizard.tsx`
Multi-step wizard with high friction:
1. **Soft Resistance**: Warning about time/evidence requirements
2. **Reason Selection**: Choose dispute reason
3. **Cooldown Check**: Category-specific eligibility gates
4. **Sworn Declaration**: Require "I CONFIRM" typed
5. **Evidence & Summary**: Min 200 chars, evidence requirements
6. **Review & Submit**: Final confirmation

#### `components/DisputeHelpButton.tsx`
Buried entry point: Small "Help" link in rift detail page

### 4. API Routes

#### Buyer Routes
- `POST /api/rifts/[id]/dispute/intent` - Log dispute intent
- `POST /api/rifts/[id]/dispute` - Create/get draft dispute
- `GET /api/rifts/[id]/dispute` - Get existing dispute
- `PATCH /api/disputes/[id]` - Update draft (reason, summary, declaration)
- `POST /api/disputes/[id]/evidence` - Add text/link evidence
- `POST /api/disputes/[id]/evidence/upload` - Upload file evidence
- `POST /api/disputes/[id]/submit` - Submit dispute (runs auto-triage)

#### Admin Routes
- `GET /api/admin/disputes` - Get dispute queue with filters
- `GET /api/admin/disputes/[id]` - Get full case details
- `POST /api/admin/disputes/[id]/request-info` - Request more information
- `POST /api/admin/disputes/[id]/resolve-seller` - Resolve in favor of seller
- `POST /api/admin/disputes/[id]/resolve-buyer` - Resolve in favor of buyer (triggers refund)
- `POST /api/admin/disputes/[id]/reject` - Reject dispute as invalid

### 5. Admin Dashboard

#### `app/admin/disputes/page.tsx`
- Dispute queue with filters (status, category, reason)
- Shows auto-triage decisions
- Links to case view

#### `app/admin/disputes/[id]/page.tsx`
- Full case view with:
  - Dispute summary + sworn declaration
  - Evidence list
  - Delivery proof (digital views, ticket transfers)
  - Event timeline (rift_events)
  - Actions history
  - Admin resolution buttons

#### `components/DisputeQueue.tsx`
Queue list component with filtering

#### `components/DisputeCaseView.tsx`
Full case view component with all evidence and admin actions

### 6. Integration

#### Release Engine (`lib/release-engine.ts`)
- Updated to check Supabase `disputes` table for active disputes
- Blocks release if status in `['submitted', 'needs_info', 'under_review']`

#### Refund Flow
- `resolve-buyer` endpoint triggers Stripe refund
- Updates rift status to `REFUNDED`
- Logs `DISPUTE_RESOLVED` event

### 7. Event Logging

All dispute actions log events:
- `DISPUTE_INTENT_OPENED` - Buyer starts dispute flow
- `DISPUTE_SUBMITTED` - Dispute submitted
- `DISPUTE_AUTO_REJECTED` - Auto-triage rejected
- `DISPUTE_RESOLVED` - Admin resolved (buyer/seller)
- `DISPUTE_REJECTED` - Admin rejected as invalid

## Setup Instructions

### 1. Database Migration

```bash
# Apply Supabase migration
# Via Supabase Dashboard SQL Editor or CLI:
supabase db push

# Or copy contents of supabase/migrations/005_phase4_disputes.sql
```

### 2. Storage Bucket

Create storage bucket in Supabase:
1. Go to Storage in Supabase Dashboard
2. Create new bucket: `dispute-evidence`
3. Set to **Private** (not public)
4. Policies handled by API (service role)

### 3. Environment Variables

Ensure these are set:
```
STRIPE_SECRET_KEY=... (for refunds)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Usage Flows

### Buyer Dispute Flow
1. Buyer clicks "Help" link (buried) → Opens wizard
2. Soft resistance screen → Continue
3. Select reason → Cooldown check
4. Sworn declaration → Type "I CONFIRM"
5. Add evidence + summary (min 200 chars)
6. Review & Submit → Auto-triage runs
7. If auto-rejected → Dispute closed, rift status restored
8. If needs review → Status `under_review`, rift status `DISPUTED`

### Admin Review Flow
1. Admin views queue at `/admin/disputes`
2. Filter by status/category/reason
3. Click dispute → Full case view
4. Review evidence, delivery proof, timeline
5. Take action:
   - Request more info → Status `needs_info`, system message posted
   - Resolve (Seller) → Status `resolved_seller`, rift eligible for release
   - Resolve (Buyer) → Status `resolved_buyer`, refund processed, rift `REFUNDED`
   - Reject → Status `rejected`, rift eligible for release

## Auto-Triage Signals

The system tracks objective signals:
- `buyerConfirmedReceipt`: Buyer confirmed receipt event exists
- `deliveryDownloaded`: Digital delivery was downloaded
- `deliverySecondsViewed`: Total seconds viewed
- `ticketBuyerConfirmed`: Ticket receipt confirmed
- `ticketEventPassed`: Event date has passed
- `serviceBuyerConfirmed`: Service completion confirmed
- `highAbuseRisk`: User has excessive disputes

## Acceptance Tests

- [ ] Dispute entry is buried (Help link only)
- [ ] Tickets: Disputes blocked after event_date
- [ ] Digital goods: Downloaded/viewed 30s+ → auto-reject "not_received"
- [ ] Services: Buyer confirmed → auto-reject (except unauthorized)
- [ ] Admin queue shows under_review disputes
- [ ] Admin can resolve both ways
- [ ] Active disputes block releaseFunds()
- [ ] All transitions create events + actions + system messages

## Notes

- Dispute entry is intentionally high-friction and buried
- Auto-triage uses objective signals only (no subjective analysis)
- All actions are logged in `dispute_actions` for audit trail
- System messages posted to chat for transparency
- Refunds use Stripe PaymentIntent refund API
- Release engine checks Supabase disputes table (not Prisma)

## Next Steps

- Add dispute cooldown periods (prevent rapid re-opening)
- Implement strike system for abuse patterns
- Add dispute statistics to user risk profiles
- Enhance evidence viewer (image preview, PDF viewer)
- Add dispute templates for common scenarios

