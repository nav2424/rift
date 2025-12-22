# End-to-End Rift Flow Test Guide

## Prerequisites

1. **Backend running**: `npm run dev` (should be on http://localhost:3000)
2. **Mobile app running**: `cd mobile && npm start`
3. **Database seeded**: At least 2 users (buyer and seller)

## Test Flow

### 1. Create Test Users

**Buyer Account:**
- Email: `buyer@test.com`
- Password: `password123`

**Seller Account:**
- Email: `seller@test.com`
- Password: `password123`

### 2. Complete Rift Flow

#### Step 1: Sign In as Buyer (Mobile)
1. Open mobile app
2. Sign in with buyer credentials
3. Should see empty dashboard

#### Step 2: Create Rift (Mobile)
1. Tap "Create" tab
2. Select item type (e.g., "Physical Item")
3. Fill in wizard:
   - **Basic Info**: Title, Description, Amount, Currency
   - **Details**: Shipping address (for physical items)
   - **Seller**: Select seller from list or enter email
   - **Review**: Confirm all details
4. Tap "Create Rift"
5. Should redirect to rift detail page

#### Step 3: Mark as Paid (Mobile - Buyer)
1. On rift detail page
2. Tap "Mark as Paid"
3. Status should change to "AWAITING_SHIPMENT"
4. Seller should receive email notification

#### Step 4: Upload Shipment Proof (Mobile - Seller)
1. Sign out and sign in as seller
2. Navigate to the rift
3. Tap "Upload Shipment Proof"
4. Enter tracking number (optional)
5. Upload image (optional)
6. Status should change to "IN_TRANSIT"
7. Buyer should receive email notification

#### Step 5: Confirm Receipt (Mobile - Buyer)
1. Sign out and sign in as buyer
2. Navigate to the rift
3. Tap "Confirm Item Received"
4. Status should change to "DELIVERED_PENDING_RELEASE"
5. Seller should receive email notification

#### Step 6: Release Funds (Mobile - Buyer)
1. On rift detail page
2. Tap "Release Funds to Seller"
3. Status should change to "RELEASED"
4. Seller should receive email notification
5. Payout should be processed (if Stripe Connect configured)

### 3. Dispute Flow Test

#### Step 1: Raise Dispute (Mobile - Buyer)
1. On an rift in "IN_TRANSIT" or "DELIVERED_PENDING_RELEASE" status
2. Tap "Raise Dispute"
3. Enter reason
4. Status should change to "DISPUTED"
5. All parties should receive email notifications

#### Step 2: Resolve Dispute (Web - Admin)
1. Go to http://localhost:3000/admin
2. Sign in as admin
3. View the dispute
4. Click "Release Funds" or "Refund Buyer"
5. Enter admin note
6. Status should update accordingly

### 4. Admin Dashboard Test (Mobile)

1. Sign in as admin user
2. Should see "Admin" tab in bottom navigation
3. Tap "Admin" tab
4. Should see:
   - Open disputes list
   - All escrows list
5. Tap any rift to view details
6. Can resolve disputes from detail page

## Common Issues & Solutions

### "Unauthorized" Error
- **Check**: JWT_SECRET is set in `.env`
- **Check**: Token is being stored in SecureStore
- **Check**: Backend is running and accessible
- **Solution**: Add `JWT_SECRET` to `.env` file

### Email Not Sending
- **Check**: SMTP credentials in `.env`
- **Note**: In development, emails are logged to console
- **Solution**: Configure SMTP for production

### Payment Processing
- **Note**: Works in mock mode without Stripe keys
- **For production**: Add `STRIPE_SECRET_KEY` to `.env`

## Verification Checklist

- [ ] User can sign in/up
- [ ] User can create rift
- [ ] Buyer can mark as paid
- [ ] Seller can upload proof
- [ ] Buyer can confirm receipt
- [ ] Buyer can release funds
- [ ] Buyer can raise dispute
- [ ] Admin can resolve dispute
- [ ] Admin can access mobile dashboard
- [ ] Timeline events are created
- [ ] Email notifications are sent (or logged)

## API Endpoints Tested

- ✅ `POST /api/escrows/create`
- ✅ `POST /api/escrows/[id]/mark-paid`
- ✅ `POST /api/escrows/[id]/upload-shipment-proof`
- ✅ `POST /api/escrows/[id]/confirm-received`
- ✅ `POST /api/escrows/[id]/release-funds`
- ✅ `POST /api/escrows/[id]/raise-dispute`
- ✅ `GET /api/admin/disputes`
- ✅ `GET /api/admin/escrows`
- ✅ `POST /api/admin/escrows/[id]/resolve-dispute`

