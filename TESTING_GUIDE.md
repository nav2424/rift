# Hybrid Protection System - Testing Guide

Complete guide for testing the Hybrid Protection System end-to-end.

## Prerequisites

1. **Backend running**: `npm run dev`
2. **Database migrated**: `npx prisma migrate dev`
3. **Test users created**: Run test script (creates them automatically)

## Quick Test (Automated)

Run the automated test script:

```bash
npm run test:hybrid-flow
```

This will:
- ✅ Create test buyer and seller accounts
- ✅ Create an rift transaction
- ✅ Mark it as paid
- ✅ Upload verified shipment proof
- ✅ Confirm receipt and set grace period
- ✅ Verify dispute restrictions
- ✅ Check auto-release eligibility

## Manual Testing Flow

### Step 1: Create Test Users

**Via Mobile App or Web:**
1. Sign up as buyer: `buyer@test.com` / `password123`
2. Sign up as seller: `seller@test.com` / `password123`

Or run:
```bash
npm run seed:demo
```

### Step 2: Create Rift (As Buyer)

1. Log in as buyer
2. Create new rift:
   - Item Type: **Physical**
   - Title: "Test Item"
   - Amount: $100
   - Shipping Address: "123 Test St"
   - Seller: `seller@test.com`

### Step 3: Pay Rift (As Buyer)

1. View the rift details
2. Click **"Pay $100 CAD"**
3. Complete Stripe payment with test card: `4242 4242 4242 4242`
4. ✅ Rift status should change to `AWAITING_SHIPMENT`

### Step 4: Upload Shipment Proof (As Seller)

1. Log in as seller
2. View the rift
3. Click **"Upload Shipment Proof"**
4. Enter tracking number (valid format):
   - **UPS**: `1Z999AA10123456784`
   - **FedEx**: `123456789012`
   - **USPS**: `9400111899223197428490`
5. Select carrier
6. Upload proof image (optional)
7. ✅ Status should change to `IN_TRANSIT`
8. ✅ Verification badges should appear

### Step 5: Confirm Receipt (As Buyer)

1. Log in as buyer
2. View the rift
3. Click **"Confirm Item Received"**
4. ✅ Status should change to `DELIVERED_PENDING_RELEASE`
5. ✅ Grace period timer should appear (48 hours)
6. ✅ Auto-release scheduled message shown

### Step 6: Test Dispute Restrictions (As Buyer)

1. Try to raise dispute
2. Click **"Raise Dispute"**
3. ✅ You should see dispute type options
4. ✅ After verified delivery, "Item Not Received" should NOT be available
5. ✅ Other types available:
   - Item Not as Described
   - Item Damaged
   - Wrong Item
   - Wrong Address

### Step 7: Test Auto-Release

**Option A: Wait for Grace Period**
- Wait 48 hours (or manually adjust database)

**Option B: Manual Trigger (For Testing)**
```bash
# Set grace period to past date in database
npx prisma studio
# Edit rift: Set gracePeriodEndsAt to yesterday

# Then run auto-release
npm run cron:auto-release
```

**Expected Result:**
- ✅ Funds released automatically
- ✅ Status changes to `RELEASED`
- ✅ Seller balance updated
- ✅ Timeline event created

## Testing Scenarios

### Scenario 1: Verified Shipment, No Delivery Confirmation

**Flow:**
1. Seller uploads verified shipment proof
2. Buyer does NOT confirm receipt
3. Status remains `IN_TRANSIT`

**Expected:**
- Buyer can still dispute "Item Not Received"
- No grace period started
- No auto-release scheduled

### Scenario 2: Verified Shipment + Delivery Confirmation

**Flow:**
1. Seller uploads verified shipment proof
2. Buyer confirms receipt
3. Grace period starts

**Expected:**
- Grace period timer visible
- Buyer CANNOT dispute "Item Not Received"
- Buyer CAN dispute other issues
- Auto-release scheduled for 48 hours

### Scenario 3: Dispute During Grace Period

**Flow:**
1. Complete steps 1-5 above
2. Buyer raises dispute (e.g., "Item Damaged")
3. Auto-release is cancelled

**Expected:**
- Status changes to `DISPUTED`
- Auto-release cancelled
- Admin can resolve dispute

### Scenario 4: Auto-Release After Grace Period

**Flow:**
1. Complete steps 1-5 above
2. Wait 48 hours (or adjust database)
3. Run auto-release cron

**Expected:**
- Funds released automatically
- Status: `RELEASED`
- No disputes possible

## Database Verification

### Check Rift Status

```bash
npx prisma studio
```

Navigate to `EscrowTransaction` and verify:
- `shipmentVerifiedAt`: Should be set after proof upload
- `trackingVerified`: Should be `true`
- `deliveryVerifiedAt`: Should be set after confirmation
- `gracePeriodEndsAt`: Should be 48 hours after delivery
- `autoReleaseScheduled`: Should be `true` after verified delivery

### Check Timeline Events

Look at `TimelineEvent` table:
- `PROOF_UPLOADED` or `PROOF_VERIFIED`
- `ITEM_CONFIRMED`
- `FUNDS_AUTO_RELEASED` (after auto-release)

### Check Dispute Types

Look at `Dispute` table:
- `type` field should show: `ITEM_NOT_RECEIVED`, `ITEM_NOT_AS_DESCRIBED`, etc.

## API Testing

### Test Auto-Release Endpoint

```bash
# Local
curl -X POST http://localhost:3000/api/escrows/auto-release

# With auth (if CRON_SECRET set)
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/escrows/auto-release
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "escrowId": "...",
      "success": true
    }
  ]
}
```

### Test Tracking Verification

```bash
# Check format validation (via shipment proof upload)
curl -X POST \
  -F "trackingNumber=1Z999AA10123456784" \
  -F "shippingCarrier=UPS" \
  http://localhost:3000/api/escrows/[id]/upload-shipment-proof
```

## Common Issues

### Issue: Auto-Release Not Working

**Check:**
1. Is grace period past? Check `gracePeriodEndsAt`
2. Are there open disputes? Check `Dispute` table
3. Is rift in correct status? Should be `DELIVERED_PENDING_RELEASE`
4. Is `autoReleaseScheduled` set to `true`?

### Issue: Dispute Types Not Showing Correctly

**Check:**
1. Is shipment verified? Check `shipmentVerifiedAt` and `trackingVerified`
2. Is delivery verified? Check `deliveryVerifiedAt`
3. Check mobile app - it should show different options based on verification status

### Issue: Grace Period Not Appearing

**Check:**
1. Did buyer confirm receipt? Check `deliveryVerifiedAt`
2. Is shipment verified? Check `trackingVerified`
3. Check mobile app refresh - might need to reload rift

## Test Checklist

- [ ] Create rift
- [ ] Pay rift (Stripe test card)
- [ ] Upload shipment proof with valid tracking
- [ ] Verify tracking format validation works
- [ ] Confirm receipt as buyer
- [ ] Verify grace period timer appears
- [ ] Test dispute restrictions (after verified delivery)
- [ ] Verify "Item Not Received" is blocked after verification
- [ ] Test other dispute types are available
- [ ] Manually trigger auto-release
- [ ] Verify funds released automatically
- [ ] Check balances updated correctly
- [ ] Verify timeline events created
- [ ] Test cron endpoint manually
- [ ] Verify cron secret protection (if set)

## Performance Testing

### Load Test Auto-Release

Create multiple escrows past grace period:
```sql
-- In Prisma Studio or SQL editor
UPDATE EscrowTransaction 
SET gracePeriodEndsAt = datetime('now', '-1 hour')
WHERE status = 'DELIVERED_PENDING_RELEASE'
AND autoReleaseScheduled = true;
```

Then run auto-release and verify all are processed.

## Next Steps

After successful testing:
1. ✅ Set up production cron job (see `CRON_SETUP.md`)
2. ✅ Configure `CRON_SECRET` for security
3. ✅ Monitor auto-release logs
4. ⏳ Optional: Integrate carrier APIs (see `CARRIER_API_SETUP.md`)

