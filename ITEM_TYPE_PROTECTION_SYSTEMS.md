# Item Type Protection Systems

This document explains the different protection and payout systems for each item type.

## Overview

Each item type has its own protection system optimized for its unique characteristics:

- **PHYSICAL**: Full hybrid protection with 48-hour grace period
- **DIGITAL**: Fast payout with 24-hour grace period
- **TICKETS**: Fast payout with 24-hour grace period (event-based)
- **SERVICES**: Fast payout with 24-hour grace period

## Physical Products (PHYSICAL)

### Protection System
✅ **Hybrid Protection Enabled**
- Shipment proof required
- Tracking number verification
- 48-hour grace period after verified delivery

### Flow
1. **Buyer pays** → Status: `AWAITING_SHIPMENT`
2. **Seller uploads shipment proof** with tracking number
   - System validates tracking format (UPS, FedEx, USPS, DHL)
   - Verification flags set: `shipmentVerifiedAt`, `trackingVerified`
   - Status: `IN_TRANSIT`
3. **Buyer confirms receipt** → Status: `DELIVERED_PENDING_RELEASE`
   - 48-hour grace period starts
   - Auto-release scheduled
4. **After 48 hours** → Funds auto-release (if no disputes)

### Dispute Restrictions
After verified shipment + delivery:
- ❌ Cannot dispute "Item Not Received"
- ✅ Can dispute: Not as described, Damaged, Wrong item, Wrong address

### Why 48 Hours?
Physical items need time for:
- Buyer to inspect item
- Package theft reporting
- Quality verification
- Damage assessment

---

## Digital Products (DIGITAL)

### Protection System
🛡️ **Balanced Protection System**
- Seller protection: Auto-release 24 hours after seller marks delivered
- Buyer protection: 24-hour window to verify and dispute
- No dependency on buyer confirmation

### Flow
1. **Buyer pays** → Status: `AWAITING_SHIPMENT`
2. **Seller marks as delivered** (if download link not provided during creation)
   - Validates download link exists
   - Status: `IN_TRANSIT`
   - 24-hour auto-release timer starts
3. **Two possible outcomes:**
   - **Buyer releases early** (optional) → Status: `RELEASED` immediately
   - **24 hours pass** → Status: `RELEASED` automatically (if no dispute)
   - **Buyer disputes** → Status: `DISPUTED` (auto-release cancelled)

### Dispute Options
- ✅ All dispute types available (no restrictions)
- Buyer can dispute during the 24-hour window
- Dispute cancels auto-release

### Why This System?
**Protects both parties:**
- **Sellers**: Don't wait for buyer confirmation - auto-release ensures payment
- **Buyers**: 24-hour window to verify and raise disputes
- **Fair**: Neither party has to rely on the other's good faith

---

## Tickets (TICKETS)

### Protection System
🛡️ **Balanced Protection System**
- Seller protection: Auto-release 24 hours after seller marks delivered
- Buyer protection: 24-hour window to verify and dispute
- No dependency on buyer confirmation

### Flow
1. **Buyer pays** → Status: `AWAITING_SHIPMENT`
2. **Seller marks tickets as transferred** (if not done during creation)
   - Validates transfer method exists
   - Status: `IN_TRANSIT`
   - 24-hour auto-release timer starts
3. **Two possible outcomes:**
   - **Buyer releases early** (optional) → Status: `RELEASED` immediately
   - **24 hours pass** → Status: `RELEASED` automatically (if no dispute)
   - **Buyer disputes** → Status: `DISPUTED` (auto-release cancelled)

### Special Considerations
- Event date verification (if implemented)
- Transfer method must be provided
- Venue information helpful for disputes

### Dispute Options
- ✅ All dispute types available
- Buyer can dispute during the 24-hour window
- Dispute cancels auto-release

### Why This System?
**Protects both parties:**
- **Sellers**: Don't wait for buyer confirmation - auto-release ensures payment
- **Buyers**: 24-hour window to verify ticket validity and raise disputes
- **Fair**: Neither party has to rely on the other's good faith

---

## Services (SERVICES)

### Protection System
🛡️ **Balanced Protection System**
- Seller protection: Auto-release 24 hours after seller marks completed
- Buyer protection: 24-hour window to verify and dispute
- No dependency on buyer confirmation

### Flow
1. **Buyer pays** → Status: `AWAITING_SHIPMENT`
2. **Seller marks service as completed** (if service date not provided during creation)
   - Validates service date exists
   - Status: `IN_TRANSIT`
   - 24-hour auto-release timer starts
3. **Two possible outcomes:**
   - **Buyer releases early** (optional) → Status: `RELEASED` immediately
   - **24 hours pass** → Status: `RELEASED` automatically (if no dispute)
   - **Buyer disputes** → Status: `DISPUTED` (auto-release cancelled)

### Dispute Options
- ✅ All dispute types available
- Buyer can dispute during the 24-hour window
- Dispute cancels auto-release

### Why This System?
**Protects both parties:**
- **Sellers**: Don't wait for buyer confirmation - auto-release ensures payment
- **Buyers**: 24-hour window to verify service quality and raise disputes
- **Fair**: Neither party has to rely on the other's good faith

---

## Comparison Table

| Feature | PHYSICAL | DIGITAL | TICKETS | SERVICES |
|---------|----------|---------|---------|----------|
| **Payout Speed** | 48 hours | 24 hours (auto) | 24 hours (auto) | 24 hours (auto) |
| **Protection Window** | 48 hours | 24 hours | 24 hours | 24 hours |
| **Seller Protection** | ✅ Hybrid protection | ✅ Auto-release | ✅ Auto-release | ✅ Auto-release |
| **Buyer Protection** | ✅ 48hr dispute window | ✅ 24hr dispute window | ✅ 24hr dispute window | ✅ 24hr dispute window |
| **Shipment Proof** | ✅ Required | ❌ Not needed | ❌ Not needed | ❌ Not needed |
| **Tracking Required** | ✅ Required | ❌ Not needed | ❌ Not needed | ❌ Not needed |
| **Hybrid Protection** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Dispute Restrictions** | ✅ After verification | ❌ None | ❌ None | ❌ None |
| **Auto-Release** | ✅ Yes (after buyer confirms) | ✅ Yes (after seller marks delivered) | ✅ Yes (after seller marks delivered) | ✅ Yes (after seller marks delivered) |
| **Buyer Can Release Early** | ✅ Yes | ✅ Yes (optional) | ✅ Yes (optional) | ✅ Yes (optional) |

---

## API Endpoints

### Physical Items
- `POST /api/escrows/[id]/upload-shipment-proof` - Upload proof with tracking
- `POST /api/escrows/[id]/confirm-received` - Confirm receipt (starts 48hr grace)

### Non-Physical Items
- `POST /api/escrows/[id]/mark-delivered` - Mark as delivered (DIGITAL/TICKETS/SERVICES)
- `POST /api/escrows/[id]/confirm-received` - Confirm receipt (starts 24hr grace)

### All Items
- `POST /api/escrows/[id]/raise-dispute` - Raise dispute
- `POST /api/escrows/[id]/release-funds` - Manual release
- `POST /api/escrows/auto-release` - Auto-release (cron)

---

## Configuration

Protection settings are configured in `lib/item-type-flows.ts`:

```typescript
export const ITEM_TYPE_CONFIGS = {
  PHYSICAL: {
    gracePeriodHours: 48,
    requiresShipmentProof: true,
    requiresTracking: true,
    allowsAutoRelease: true,
  },
  DIGITAL: {
    gracePeriodHours: 24,
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true,
  },
  TICKETS: {
    gracePeriodHours: 24,
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true,
  },
  SERVICES: {
    gracePeriodHours: 24,
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true,
  },
}
```

---

## Mobile UI Differences

### Physical Items
- "Upload Shipment Proof" button (seller)
- Verification badges shown
- Hybrid protection messaging
- Restricted dispute types after verification

### Non-Physical Items
- "Mark as Delivered" button (seller)
- Fast payout indicator
- All dispute types available
- Faster grace period messaging

---

## Benefits

### For Sellers
- **Physical**: Protected from "not received" scams after verification
- **Digital/Tickets/Services**: Faster payouts (24 hours vs 48 hours)

### For Buyers
- **Physical**: Can still dispute quality issues after verification
- **Digital/Tickets/Services**: Full protection with faster resolution

### For Platform
- Appropriate protection for each item type
- Faster transactions for instant items
- Reduced disputes through proper verification
- Better user experience

---

## Future Enhancements

1. **Event Date Verification** (Tickets)
   - Auto-release after event date passes
   - Verify tickets are valid for event

2. **Service Completion Evidence** (Services)
   - Optional proof upload
   - Before/after photos
   - Completion certificates

3. **Digital Product Verification** (Digital)
   - License key validation
   - Download link accessibility check
   - Product authenticity verification

