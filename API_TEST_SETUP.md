# API Endpoint Testing Setup

This guide explains how to test the Rift API endpoints through HTTP requests.

## Prerequisites

### 1. Development Server Running
The API test requires the Next.js dev server to be running:

```bash
npm run dev
```

The server should be accessible at `http://localhost:3000` (default).

### 2. Environment Variables
Make sure your `.env` file has:
- `DATABASE_URL` - Database connection
- `JWT_SECRET` or `NEXTAUTH_SECRET` - For JWT token generation
- (Optional) `API_URL` - Override API base URL (default: http://localhost:3000)

### 3. Database Ready
- Prisma client generated: `npx prisma generate`
- Migrations applied: `npx prisma migrate deploy`

## Running API Tests

### Option 1: Using npm script (Recommended)
```bash
npm run test:rift-api
```

### Option 2: Direct execution
```bash
npx tsx scripts/test-rift-api.ts
```

### Option 3: With custom API URL
```bash
API_URL=http://localhost:3000 npm run test:rift-api
```

## What Gets Tested

The API test script tests:

1. **POST /api/rifts/create**
   - Creates a new rift via API
   - Tests authentication
   - Verifies response structure

2. **POST /api/rifts/[id]/fund**
   - Creates payment intent
   - Verifies Stripe integration

3. **PUT /api/rifts/[id]/fund**
   - Confirms payment
   - Verifies status transition to FUNDED

4. **POST /api/rifts/[id]/release**
   - Releases funds to seller
   - Verifies status transition to RELEASED
   - Verifies wallet credit

5. **GET /api/rifts/list**
   - Lists user's rifts
   - Verifies created rift appears

## Test Output

```
🧪 Starting API Endpoint Testing

API Base URL: http://localhost:3000

Step 1: Setting up test users...
✅ Test users ready

Step 2: Creating rift via API...
  POST /api/rifts/create
✅ Rift created via API: <rift-id>

Step 3: Verifying rift data...
✅ Rift verified: Status=AWAITING_PAYMENT, BuyerFee=$3.00, SellerFee=$5.00, SellerNet=$95.00

Step 4: Creating payment intent via API...
  POST /api/rifts/<id>/fund
✅ Payment intent created: <payment-intent-id>

Step 5: Confirming payment via API...
  PUT /api/rifts/<id>/fund
✅ Payment confirmed: Status=FUNDED

Step 6: Submitting proof...
✅ Proof submitted: Status=PROOF_SUBMITTED

Step 7: Releasing funds via API...
  POST /api/rifts/<id>/release
✅ Funds released: Status=RELEASED, Wallet Balance=$95.00

Step 8: Testing GET /api/rifts/list...
  GET /api/rifts/list
✅ Rift found in list (X total rifts)

============================================================
API TEST SUMMARY
============================================================
Total steps: 8
✅ Successful: 8
❌ Failed: 0

🎉 All API tests passed!
```

## Troubleshooting

### Error: "ECONNREFUSED" or "Failed to fetch"
**Cause**: Dev server not running

**Solution**:
```bash
# Start the dev server in a separate terminal
npm run dev

# Then run the test in another terminal
npm run test:rift-api
```

### Error: "Unauthorized" or 401 status
**Cause**: JWT token not valid or missing

**Solution**:
- Check that `JWT_SECRET` or `NEXTAUTH_SECRET` is set in `.env`
- Ensure the secret matches what your API expects
- Check that test users exist and are created correctly

### Error: "Invalid payment intent" or Stripe errors
**Cause**: Stripe not configured or payment intent creation failed

**Solution**:
- In development, Stripe operations may be mocked
- Check `lib/stripe.ts` for mock mode behavior
- For real Stripe testing, set `STRIPE_SECRET_KEY` in `.env`

### Error: "Rift not found" or database errors
**Cause**: Database connection issue or data not persisted

**Solution**:
- Verify `DATABASE_URL` is correct in `.env`
- Check database is accessible
- Verify Prisma client is generated: `npx prisma generate`

## Keeping Test Data

To keep test data for inspection:
```bash
KEEP_TEST_DATA=true npm run test:rift-api
```

## Manual API Testing with curl

You can also test endpoints manually:

### 1. Get auth token (via mobile signin)
```bash
curl -X POST http://localhost:3000/api/auth/mobile-signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test-buyer@rift.test","password":"test-password"}'
```

### 2. Create rift
```bash
TOKEN="your-jwt-token-here"
curl -X POST http://localhost:3000/api/rifts/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemTitle": "Test Item",
    "itemDescription": "Test",
    "itemType": "DIGITAL",
    "amount": 100,
    "currency": "CAD",
    "creatorRole": "BUYER",
    "partnerId": "seller-id"
  }'
```

### 3. Create payment intent
```bash
RIFT_ID="rift-id-here"
curl -X POST http://localhost:3000/api/rifts/$RIFT_ID/fund \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

## Differences from Database Test

The API test (`test-rift-api.ts`) differs from the database test (`test-rift-flow.ts`):

- **API Test**: Tests HTTP endpoints, authentication, request/response handling
- **Database Test**: Tests database operations directly, faster, no server needed

Both are valuable:
- **API Test**: Verifies the full stack works end-to-end
- **Database Test**: Quick verification of core logic

## Next Steps

After API tests pass:

1. **Test UI flows** - Test through the web interface
2. **Test error cases** - Invalid inputs, unauthorized access, etc.
3. **Load testing** - Test with concurrent requests
4. **Integration testing** - Test with real Stripe in test mode

