# Timeline Events Checklist

This document lists all events that should appear in a Rift timeline and where they're created.

## Expected Timeline Events (in chronological order)

1. **Rift Created** (`ESCROW_CREATED`)
   - Created in: `app/api/rifts/create/route.ts`
   - Message: "Rift created by [buyer/seller] for [itemTitle]"

2. **Payment Received** (`PAYMENT_RECEIVED`)
   - Created in: `app/api/rifts/[id]/fund/route.ts`
   - Message: "Payment received: [currency] [amount]"

3. **Proof Submitted** (`PROOF_SUBMITTED`)
   - Created in: `app/api/rifts/[id]/proof/route.ts`
   - Message: "Proof submitted - awaiting admin review"

4. **Proof Under Review** (`STATUS_CHANGE`)
   - Created in: `lib/rift-state.ts` (when transitioning to UNDER_REVIEW)
   - Message: "Proof under review"

5. **Proof Approved** (`PROOF_APPROVED`)
   - Created in: `app/api/admin/proofs/[id]/approve/route.ts`
   - Message: "Proof approved by admin"

6. **Proof Rejected** (`PROOF_REJECTED`) - if rejected
   - Created in: `app/api/admin/proofs/[id]/reject/route.ts`
   - Message: "Proof rejected by admin"

7. **Status Change to PROOF_SUBMITTED** (`STATUS_CHANGE`)
   - Created in: `lib/rift-state.ts` (when transitioning from UNDER_REVIEW to PROOF_SUBMITTED after approval)
   - Message: "Proof of delivery submitted"

8. **Funds Released** (`FUNDS_RELEASED`)
   - Created in: `app/api/rifts/[id]/release-funds/route.ts` or `lib/rift-state.ts` (handleRelease)
   - Message: "Funds released. Amount: [currency] [amount]"

9. **Dispute Raised** (`DISPUTE_RAISED`)
   - Created in: `app/api/rifts/[id]/raise-dispute/route.ts`
   - Message: "Dispute raised: [reason]"

10. **Dispute Resolved** (`DISPUTE_RESOLVED`)
    - Created in: `app/api/admin/rifts/[id]/resolve-dispute/route.ts`
    - Message: "Dispute resolved: [resolution]"

## Debugging Missing Events

If events are missing, check:

1. **API Response**: Verify `/api/rifts/[id]` returns all timeline events
2. **Database**: Query `TimelineEvent` table directly for the rift ID
3. **Console Logs**: Check server logs for "Created timeline event" messages
4. **Error Handling**: Check if timeline event creation is failing silently

## Common Issues

- **Proof approval event missing**: Check if admin approval endpoint is being called and creating the event
- **Status change events missing**: Verify `transitionRiftState` is being called and creating events
- **Duplicate prevention too aggressive**: The duplicate checks might be preventing legitimate events
