# Hybrid Protection System

## Overview

The Hybrid Protection System **applies only to PHYSICAL products** and reduces seller risk while maintaining buyer protection for legitimate disputes. Once a seller uploads verified shipment proof with tracking, and delivery is confirmed, buyers can no longer claim "item not received" but can still dispute other valid issues.

**For other item types** (DIGITAL, TICKETS, SERVICES), see [ITEM_TYPE_PROTECTION_SYSTEMS.md](./ITEM_TYPE_PROTECTION_SYSTEMS.md) for their faster payout flows.

## How It Works

### 1. Shipment Verification (PHYSICAL ITEMS ONLY)
- **Seller uploads proof**: Shipment proof with tracking number is uploaded
- **System verifies**: 
  - Tracking number format is validated against carrier patterns (UPS, FedEx, USPS, DHL)
  - Proof file is validated
  - Address matches rift shipping address
- **Status**: Rift marked as `shipmentVerifiedAt` and `trackingVerified: true`
- **Note**: This verification is only required for PHYSICAL items

### 2. Delivery Confirmation
- **Two ways to confirm delivery**:
  1. **Buyer confirms**: Buyer clicks "Confirm Item Received"
  2. **Tracking shows delivered**: System checks tracking API (TODO: implement carrier API integration)

- **When delivery confirmed**:
  - `deliveryVerifiedAt` is set
  - 48-hour grace period starts (`gracePeriodEndsAt`)
  - `autoReleaseScheduled: true` is set
  - Status changes to `DELIVERED_PENDING_RELEASE`

### 3. Grace Period (48 Hours - PHYSICAL ONLY)
- **Buyer protection**: Buyer has 48 hours after confirmed delivery to raise disputes
- **Note**: PHYSICAL items get 48 hours. Other item types get 24 hours (see ITEM_TYPE_PROTECTION_SYSTEMS.md)
- **Allowed disputes after verified delivery**:
  - ✅ Item not as described
  - ✅ Item damaged
  - ✅ Wrong item received
  - ✅ Wrong address (with proof)
  - ❌ Item not received (blocked - shipment was verified)

- **Auto-release**: If no dispute is raised within 48 hours, funds automatically release to seller

### 4. Auto-Release System
- **Endpoint**: `POST /api/escrows/[id]/auto-release` (or `GET` for testing)
- **Process**: 
  1. Finds escrows past grace period
  2. Checks for open disputes
  3. Releases funds if no disputes
  4. Updates balances and sends notifications
  5. Awards XP, levels, milestones, badges

- **Scheduling**: Set up a cron job to call this endpoint periodically:
  ```bash
  # Run every hour
  0 * * * * curl https://your-domain.com/api/escrows/auto-release
  ```

  Or use Vercel Cron (add to `vercel.json`):
  ```json
  {
    "crons": [{
      "path": "/api/escrows/auto-release",
      "schedule": "0 * * * *"
    }]
  }
  ```

## Database Schema Changes

### EscrowTransaction
- `shipmentVerifiedAt: DateTime?` - When shipment proof was verified
- `trackingVerified: Boolean` - Whether tracking was verified
- `deliveryVerifiedAt: DateTime?` - When delivery was confirmed
- `gracePeriodEndsAt: DateTime?` - When auto-release will happen
- `autoReleaseScheduled: Boolean` - Whether auto-release is scheduled

### ShipmentProof
- `verified: Boolean` - Whether tracking was verified
- `deliveryStatus: String?` - "in_transit", "delivered", etc.
- `deliveryDate: DateTime?` - When package was delivered
- `updatedAt: DateTime` - Last update timestamp

### Dispute
- `type: DisputeType` - Type of dispute (ITEM_NOT_RECEIVED, ITEM_NOT_AS_DESCRIBED, ITEM_DAMAGED, WRONG_ITEM, WRONG_ADDRESS, OTHER)

## API Endpoints

### Upload Shipment Proof
- **Endpoint**: `POST /api/escrows/[id]/upload-shipment-proof`
- **Changes**: 
  - Validates tracking number format
  - Verifies shipment proof
  - Sets `shipmentVerifiedAt` and `trackingVerified`
  - If already delivered, sets grace period immediately

### Confirm Received
- **Endpoint**: `POST /api/escrows/[id]/confirm-received`
- **Changes**:
  - Sets `deliveryVerifiedAt` and `gracePeriodEndsAt`
  - If shipment was verified, enables auto-release scheduling
  - Shows grace period message to buyer

### Raise Dispute
- **Endpoint**: `POST /api/escrows/[id]/raise-dispute`
- **Body**: `{ reason: string, type?: string }`
- **Changes**:
  - Validates dispute type based on verification status
  - Blocks "ITEM_NOT_RECEIVED" after verified delivery
  - Cancels auto-release if dispute is raised
  - Supports dispute types: ITEM_NOT_RECEIVED, ITEM_NOT_AS_DESCRIBED, ITEM_DAMAGED, WRONG_ITEM, WRONG_ADDRESS, OTHER

### Auto-Release
- **Endpoint**: `POST /api/escrows/auto-release` (or `GET`)
- **Purpose**: Processes escrows past grace period
- **Returns**: List of processed escrows with success/error status

## Mobile UI Changes

### Rift Detail Screen
- **Verification Status**: Shows green checkmarks for verified shipment and tracking
- **Grace Period Timer**: Displays countdown timer showing when funds will auto-release
- **Dispute Types**: Shows different dispute options based on verification status

### Dispute Flow
- **Before verified delivery**: All dispute types available (including "Item Not Received")
- **After verified delivery**: Only allows disputes for item quality/description issues

## Tracking Verification

### Current Implementation
- **Format validation**: Checks tracking number format against carrier patterns
- **Carrier detection**: Automatically detects carrier from tracking number format
- **Placeholder API**: Currently returns valid but not-delivered status

### TODO: Carrier API Integration
The tracking verification service (`lib/tracking-verification.ts`) has placeholder functions for actual carrier API calls. To implement:

1. **UPS**: https://developer.ups.com/
2. **FedEx**: https://developer.fedex.com/
3. **USPS**: https://www.usps.com/business/web-tools-apis/
4. **DHL**: https://developer.dhl.com/

Update `verifyTracking()` and `checkDeliveryStatus()` in `lib/tracking-verification.ts` to make actual API calls.

## Benefits

1. **Reduces Seller Risk**: Sellers protected from "item not received" scams after verification
2. **Maintains Buyer Protection**: Buyers can still dispute legitimate issues (damage, wrong item, etc.)
3. **Clear Rules**: Both parties know exactly when protection applies
4. **Automated**: Auto-release reduces manual intervention
5. **Faster Transactions**: 48-hour grace period is faster than indefinite holds

## Edge Cases Handled

1. **Lost packages**: Even if tracking shows delivered, buyer can dispute "damaged" or "wrong item"
2. **Package theft**: Buyer can dispute if item was stolen after delivery
3. **Wrong address**: Buyer can dispute with proof of wrong delivery address
4. **Item quality**: Buyers always have right to dispute item quality/description issues

## Future Enhancements

1. **Carrier API Integration**: Real-time tracking status updates
2. **Webhook Integration**: Carrier webhooks for delivery notifications
3. **Tiered Protection**: Different grace periods based on item value
4. **Signature Confirmation**: Require signature for high-value items
5. **Insurance Options**: Offer shipping insurance for expensive items

