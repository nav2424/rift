# Carrier API Integration Setup (Optional)

The Hybrid Protection System supports real-time tracking verification via carrier APIs. This is optional - the system works without it, but carrier API integration provides automatic delivery status updates.

## Overview

Currently, tracking numbers are validated for format, but actual delivery status is confirmed when:
1. Buyer manually confirms receipt
2. You integrate carrier APIs (this guide)

## Supported Carriers

- ✅ **UPS** - Via UPS Developer API
- ✅ **FedEx** - Via FedEx API
- ✅ **USPS** - Via USPS Web Tools API
- ✅ **DHL** - Via DHL Developer API

## Setup Instructions

### 1. UPS API Integration

**Get API Credentials:**
1. Sign up at https://developer.ups.com/
2. Create an app to get API Key
3. Follow OAuth 2.0 setup guide

**Configure:**
```env
UPS_API_KEY=your_ups_api_key
```

**Implementation:** Update `checkUPSTracking()` in `lib/tracking-verification.ts`

**API Docs:** https://developer.ups.com/api/reference

---

### 2. FedEx API Integration

**Get API Credentials:**
1. Sign up at https://developer.fedex.com/
2. Register your app
3. Get API Key and Secret

**Configure:**
```env
FEDEX_API_KEY=your_fedex_api_key
FEDEX_API_SECRET=your_fedex_api_secret
```

**Implementation:** Update `checkFedExTracking()` in `lib/tracking-verification.ts`

**API Docs:** https://developer.fedex.com/api/en-us

---

### 3. USPS API Integration

**Get API Credentials:**
1. Register at https://www.usps.com/business/web-tools-apis/
2. Request API access
3. Get User ID

**Configure:**
```env
USPS_USER_ID=your_usps_user_id
```

**Implementation:** Update `checkUSPSTracking()` in `lib/tracking-verification.ts`

**API Docs:** https://www.usps.com/business/web-tools-apis/track-and-confirm-api.htm

---

### 4. DHL API Integration

**Get API Credentials:**
1. Sign up at https://developer.dhl.com/
2. Create an app
3. Get API Key and Secret

**Configure:**
```env
DHL_API_KEY=your_dhl_api_key
DHL_API_SECRET=your_dhl_api_secret
```

**Implementation:** Update `checkDHLTracking()` in `lib/tracking-verification.ts`

**API Docs:** https://developer.dhl.com/

## Implementation Example (UPS)

Here's a sample implementation structure:

```typescript
async function checkUPSTracking(
  trackingNumber: string,
  apiKey: string
): Promise<{ isDelivered: boolean; deliveryDate?: Date; status?: string }> {
  // 1. Get OAuth token
  const tokenResponse = await fetch('https://wwwcie.ups.com/security/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-merchant-id': 'your_merchant_id',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  })
  const { access_token } = await tokenResponse.json()

  // 2. Get tracking details
  const trackResponse = await fetch(
    `https://wwwcie.ups.com/api/track/v1/details/${trackingNumber}`,
    {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'transId': 'unique-transaction-id',
        'transactionSrc': 'your-app-name',
      },
    }
  )
  const data = await trackResponse.json()

  // 3. Parse response
  const statusCode = data.trackingResponse?.shipment[0]?.package[0]?.activity[0]?.status?.code
  const deliveryDate = data.trackingResponse?.shipment[0]?.package[0]?.activity[0]?.date
  
  return {
    isDelivered: statusCode === 'D', // 'D' = Delivered
    deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
    status: data.trackingResponse?.shipment[0]?.package[0]?.activity[0]?.status?.description,
  }
}
```

## Automatic Delivery Updates

After implementing carrier APIs, you can set up a scheduled job to check delivery status:

### Create Delivery Status Checker

Add to `lib/auto-release.ts` or create new `lib/delivery-checker.ts`:

```typescript
export async function checkDeliveryStatusForAll() {
  const escrows = await prisma.escrowTransaction.findMany({
    where: {
      itemType: 'PHYSICAL',
      shipmentVerifiedAt: { not: null },
      deliveryVerifiedAt: null, // Not yet delivered
      status: 'IN_TRANSIT',
      shipmentProofs: {
        some: {
          trackingNumber: { not: null },
        },
      },
    },
    include: {
      shipmentProofs: {
        where: { trackingNumber: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  for (const rift of escrows) {
    const proof = rift.shipmentProofs[0]
    if (!proof?.trackingNumber) continue

    try {
      const { isDelivered, deliveryDate } = await checkDeliveryStatus(
        proof.trackingNumber,
        proof.shippingCarrier || undefined
      )

      if (isDelivered && deliveryDate) {
        // Update rift with delivery confirmation
        const gracePeriodHours = 48
        const gracePeriodEndsAt = new Date(
          deliveryDate.getTime() + gracePeriodHours * 60 * 60 * 1000
        )

        await prisma.escrowTransaction.update({
          where: { id: rift.id },
          data: {
            deliveryVerifiedAt: deliveryDate,
            gracePeriodEndsAt,
            autoReleaseScheduled: true,
            status: 'DELIVERED_PENDING_RELEASE',
          },
        })

        // Update shipment proof
        await prisma.shipmentProof.update({
          where: { id: proof.id },
          data: {
            deliveryStatus: 'DELIVERED',
            deliveryDate,
          },
        })

        // Send notification to buyer
        // ... send email/push notification
      }
    } catch (error) {
      console.error(`Error checking delivery for rift ${rift.id}:`, error)
    }
  }
}
```

### Schedule Delivery Checks

Add to your cron setup (same as auto-release):

```json
{
  "crons": [
    {
      "path": "/api/escrows/auto-release",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/escrows/check-delivery",
      "schedule": "*/30 * * * *"  // Every 30 minutes
    }
  ]
}
```

## Testing

### Test Tracking Format Validation

The system validates tracking number formats even without API integration:

```typescript
import { validateTrackingFormat, detectCarrier } from '@/lib/tracking-verification'

// Valid UPS tracking: 1Z999AA10123456784
validateTrackingFormat('1Z999AA10123456784', 'UPS') // true

// Auto-detect carrier
detectCarrier('1Z999AA10123456784') // 'UPS'
```

### Test API Integration

1. Get test tracking numbers from carrier
2. Call the verification function:
   ```typescript
   import { verifyTracking } from '@/lib/tracking-verification'
   const result = await verifyTracking('1Z999AA10123456784', 'UPS')
   console.log(result)
   ```

## Cost Considerations

Most carrier APIs have:
- **Free tier**: Limited requests per day/month
- **Paid tiers**: Higher rate limits

**Recommendations:**
- Start with format validation only (free)
- Add API integration for high-volume sellers
- Cache results to reduce API calls
- Use webhooks where available (cheaper than polling)

## Webhook Integration (Future Enhancement)

Some carriers support webhooks for delivery updates:
- More efficient than polling
- Real-time updates
- Lower API costs

Consider implementing webhook endpoints:
- `/api/webhooks/ups-delivery`
- `/api/webhooks/fedex-delivery`
- etc.

## Current Status

✅ **Format Validation**: Fully implemented
✅ **Carrier Detection**: Fully implemented
⏳ **API Integration**: Structure ready, needs implementation
⏳ **Automatic Updates**: Pending API integration

## Support

For implementation help:
- Check carrier API documentation (links above)
- Review example implementations in `lib/tracking-verification.ts`
- Test with carrier-provided test tracking numbers

