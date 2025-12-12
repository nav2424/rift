# Rift - Escrow Platform

## Overview

Rift is a complete escrow platform for marketplace/classified sellers (e.g., Kijiji, Facebook Marketplace) that provides secure transaction handling between buyers and sellers.

## Features

- **User Authentication**: Email/password authentication with role-based access (USER/ADMIN)
- **Escrow Management**: Create, track, and manage escrow transactions
- **Payment Processing**: Secure payment handling for escrow transactions
- **Shipment Proof**: Sellers can upload tracking and proof of shipment
- **Dispute Resolution**: Buyers can raise disputes, admins can resolve them
- **Admin Panel**: Full admin interface for managing disputes and transactions
- **Timeline Tracking**: Complete audit trail of all escrow actions

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS (dark theme)
- **Database**: Prisma ORM + SQLite
- **Authentication**: NextAuth.js (Credentials provider)
- **Password Hashing**: bcryptjs

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   The `.env` file should already exist with:
   ```
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET=your-secret-key-change-in-production
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Run database migrations**:
   ```bash
   npx prisma migrate dev
   ```

5. **Generate Prisma Client** (if needed):
   ```bash
   npx prisma generate
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Test Flow

### 1. Create Accounts

1. **Create a Buyer Account**:
   - Go to `/auth/signup`
   - Sign up with email: `buyer@test.com` (or any email)
   - Password: `password123` (minimum 6 characters)

2. **Create a Seller Account**:
   - Sign out (if logged in)
   - Go to `/auth/signup`
   - Sign up with email: `seller@test.com`
   - Password: `password123`

3. **Create an Admin Account** (optional, for testing admin features):
   - You can manually update the database to set a user's role to `ADMIN`:
   ```bash
   npx prisma studio
   ```
   - Or use Prisma CLI to update:
   ```bash
   npx prisma db execute --stdin
   # Then run: UPDATE User SET role = 'ADMIN' WHERE email = 'admin@test.com';
   ```

### 2. Create an Escrow Transaction

1. **Sign in as Buyer** (`buyer@test.com`)
2. Go to **Dashboard** → **Create New Escrow**
3. Fill in the form:
   - Item Title: "iPhone 13 Pro"
   - Description: "Brand new, unopened"
   - Amount: `1000`
   - Currency: `CAD`
   - Seller: Select `seller@test.com` from dropdown (or enter email)
   - Shipping Address: "123 Main St, Toronto, ON"
4. Click **Create Escrow**

### 3. Process Payment

1. On the escrow detail page, click **"Mark as Paid"**
2. Status changes to `AWAITING_SHIPMENT`
3. A payment reference is generated

### 4. Upload Shipment Proof

1. **Sign out and sign in as Seller** (`seller@test.com`)
2. Go to **Dashboard** → Find the escrow → Click to view details
3. In the **"Upload Shipment Proof"** section:
   - Tracking Number: `TRACK123456`
   - Shipping Carrier: `Canada Post`
   - (Optional) Upload a file
   - (Optional) Add notes
4. Click **Upload Proof**
5. Status changes to `IN_TRANSIT`

### 5. Confirm Receipt

1. **Sign out and sign in as Buyer** (`buyer@test.com`)
2. Go to the escrow detail page
3. Click **"Confirm Item Received"**
4. Status changes to `DELIVERED_PENDING_RELEASE`
5. Click **"Release Funds to Seller"**
6. Status changes to `RELEASED`

### 6. Raise and Resolve a Dispute

1. **As Buyer**, on an `IN_TRANSIT` or `DELIVERED_PENDING_RELEASE` escrow:
   - Click **"Raise Dispute"** in the sidebar
   - Enter reason: "Item not received"
   - Submit
   - Status changes to `DISPUTED`

2. **Sign in as Admin**:
   - Go to `/admin`
   - View the dispute in the list
   - Click **View** to see escrow details
   - In the Actions sidebar:
     - Click **"Release Funds to Seller"** (if seller is in the right)
     - OR **"Refund Buyer"** (if buyer is in the right)
   - Enter an admin resolution note
   - Status updates to `RELEASED` or `REFUNDED`

## Project Structure

```
trusthold/
├── app/
│   ├── api/              # API routes
│   ├── auth/             # Authentication pages
│   ├── dashboard/        # User dashboard
│   ├── escrows/          # Escrow management
│   ├── admin/            # Admin panel
│   ├── pricing/          # Marketing pages
│   └── legal/            # Legal pages
├── components/           # React components
├── lib/                  # Utility functions
├── prisma/               # Database schema
└── public/               # Static files
```

## Key Files

- `prisma/schema.prisma` - Database schema
- `lib/auth.ts` - NextAuth configuration
- `lib/rules.ts` - Escrow state machine logic
- `lib/payments.ts` - Payment processing
- `app/api/escrows/` - Escrow API routes
- `app/api/admin/` - Admin API routes

## Escrow State Machine

The escrow follows a strict state machine:

1. **AWAITING_PAYMENT** → Buyer marks as paid → **AWAITING_SHIPMENT**
2. **AWAITING_SHIPMENT** → Seller uploads proof → **IN_TRANSIT**
3. **IN_TRANSIT** → Buyer confirms → **DELIVERED_PENDING_RELEASE**
4. **DELIVERED_PENDING_RELEASE** → Buyer releases → **RELEASED**
5. **IN_TRANSIT** or **DELIVERED_PENDING_RELEASE** → Buyer disputes → **DISPUTED**
6. **DISPUTED** → Admin resolves → **RELEASED** or **REFUNDED**
7. **AWAITING_PAYMENT** or **AWAITING_SHIPMENT** → Buyer cancels → **CANCELLED**

## Security Notes

- All API routes verify authentication
- Role-based access control enforced
- Server-side validation of all state transitions
- Password hashing with bcrypt
- Only buyers/sellers/admins can view their escrows

## Current Features

- **Payment processing**: Integrated payment handling
- **File uploads**: Shipment proof storage in `/public/uploads`
- **Dispute resolution**: Admin-managed dispute handling
- **Timeline tracking**: Complete audit trail of all actions

## Future Enhancements

- Integrate real payment processor (Stripe, PayPal)
- Cloud file storage (S3, Cloudinary)
- Email notifications
- SMS alerts
- Multi-currency support
- Advanced dispute resolution workflow
- Mobile app

## License

Copyright © 2024 TrustHold. All rights reserved.
