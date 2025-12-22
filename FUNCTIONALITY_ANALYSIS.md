# Complete Functionality Analysis - Rift Platform

## Table of Contents
1. [Dashboard](#dashboard)
2. [Rifts](#rifts)
3. [Activity](#activity)
4. [Messages](#messages)
5. [Account](#account)
6. [Admin](#admin)
7. [Wallet](#wallet)
8. [Additional Features](#additional-features)

---

## Dashboard (`/dashboard`)

### Overview
The dashboard is the central hub where users view their rift transactions, metrics, and pending actions. It provides real-time updates and a comprehensive overview of the user's transaction portfolio.

### Key Features

#### 1. **Real-Time Rift Sync**
- Uses Supabase real-time subscriptions via `subscribeToUserEscrows()`
- Automatically updates rift statuses without manual refresh
- Handles both updates to existing escrows and new rift creation

#### 2. **Transaction Metrics**
- **Active Count**: Number of active transactions (FUNDED, PROOF_SUBMITTED, UNDER_REVIEW, etc.)
- **Buying/Selling Count**: Separate counts for transactions where user is buyer vs seller
- **Disputed Count**: Number of transactions in dispute
- **Total Value**: Sum of all active and completed transaction amounts
- **Active Value**: Value currently in active rifts
- **Completed Value**: Value from settled transactions
- **Success Rate**: Percentage of completed vs total transactions
- Excludes cancelled escrows from all calculations

#### 3. **Wallet Integration**
- Displays wallet balance card showing:
  - Available balance
  - Pending balance (funds awaiting release)
  - Recent ledger entries (last 3 transactions)
  - Withdraw button (links to `/wallet`)

#### 4. **Portfolio Summary**
- Total transaction value card
- Breakdown of funds in rifts vs settled funds
- Visual representation of financial position

#### 5. **Actions Required Section**
- Highlights escrows requiring user action:
  - **For Buyers**: 
    - Pay rift (AWAITING_PAYMENT)
    - Wait for proof (FUNDED)
    - Review and release (PROOF_SUBMITTED, UNDER_REVIEW)
    - Confirm receipt (DELIVERED_PENDING_RELEASE)
  - **For Sellers**:
    - Submit proof (FUNDED)
    - Wait for release (PROOF_SUBMITTED, UNDER_REVIEW)
- Shows up to 2 items by default, expandable to show all
- Each action links directly to the relevant rift detail page

#### 6. **Recent Activity Feed**
- Shows last 6 escrows sorted by creation date
- Displays status-based messages with context-aware text
- Links to full activity page (`/activity`)
- Color-coded status indicators

#### 7. **Your Rifts Section**
- Lists active escrows (up to 3 by default)
- Shows:
  - Rift number (or last 4 chars of ID if no number)
  - Status badge with color coding
  - Item title
  - Other party name/email
  - Item type
  - Transaction amount (with buyer fee if applicable)
- Links to view all rifts (`/rifts`)

#### 8. **Notifications**
- Notification badge with unread count
- Auto-refreshes every 60 seconds
- Special handling for Stripe status change notifications (KYC/verification updates)
- Links to wallet page for important notifications

#### 9. **Empty States**
- Graceful handling when user has no escrows
- Encourages users to create their first rift
- Contextual messaging based on user state

### Technical Implementation
- **Framework**: Next.js 14 App Router (client component)
- **State Management**: React hooks (useState, useEffect, useMemo)
- **Real-time**: Supabase real-time subscriptions
- **Authentication**: NextAuth session management
- **Data Fetching**: REST API endpoints (`/api/escrows/list`, `/api/wallet`, `/api/notifications`)

---

## Rifts (`/rifts`)

### Overview
A dedicated page for viewing and filtering all rift transactions with comprehensive filtering and search capabilities.

### Key Features

#### 1. **Filtering System**
- **All**: Shows all escrows
- **Active**: AWAITING_PAYMENT, AWAITING_SHIPMENT, IN_TRANSIT, DELIVERED_PENDING_RELEASE
- **Completed**: RELEASED status only
- **Cancelled**: CANCELLED status
- Filter buttons with active state highlighting

#### 2. **Transaction List View**
Each rift card displays:
- **Rift Number**: Sequential ID or last 4 chars of UUID
- **Status Badge**: Color-coded status indicator
- **Item Title**: Description of the item/service
- **Item Type**: PHYSICAL, DIGITAL, TICKETS, SERVICES
- **Role Indicator**: Shows if user is buyer or seller
- **Other Party**: Name or email of transaction partner
- **Amount**: Transaction value in specified currency
- **Creation Date**: When the rift was created
- Clicking any card navigates to detailed rift page

#### 3. **Status Color Coding**
- **RELEASED**: Green (completed successfully)
- **REFUNDED**: Red (refunded)
- **DISPUTED**: Yellow (dispute in progress)
- **CANCELLED**: Gray (cancelled)
- **AWAITING_PAYMENT**: Blue (payment pending)
- **AWAITING_SHIPMENT**: Purple (awaiting proof)
- **IN_TRANSIT**: Cyan (shipping in progress)
- **DELIVERED_PENDING_RELEASE**: Teal (delivered, awaiting release)

#### 4. **Empty States**
- Different messaging based on selected filter
- Call-to-action to create first rift when no rifts exist

### Technical Implementation
- Client-side filtering using React useMemo
- All escrows loaded via `/api/escrows/list`
- Responsive grid layout
- Glass morphism design system

---

## Activity (`/activity`)

### Overview
An enhanced activity feed that provides detailed transaction history with search and advanced filtering capabilities.

### Key Features

#### 1. **Advanced Filtering**
- **All**: Complete transaction history
- **Active**: Transactions in progress
- **Completed**: Successfully completed transactions
- **Pending**: Transactions awaiting user action (context-aware based on user role)
- **Cancelled**: Cancelled or refunded transactions

#### 2. **Search Functionality**
- Search by:
  - Rift number
  - Item title
  - Buyer name/email
  - Seller name/email
- Real-time search filtering
- Search input with placeholder text

#### 3. **Activity Items**
Each activity entry shows:
- **Status Message**: Context-aware message describing current state
- **Status Badge**: Color-coded status indicator
- **Amount**: Transaction value
- **Date**: Creation timestamp
- Links to full rift detail page

#### 4. **Status Messages**
Context-aware messages based on:
- Transaction status
- User role (buyer vs seller)
- Other party information

Examples:
- "Rift #123 — You created a rift with John — awaiting payment"
- "Rift #124 — Payment received — submit proof of delivery"
- "Rift #125 — Shipment delivered — waiting for your confirmation"

#### 5. **Sorting**
- All activities sorted by creation date (newest first)
- Chronological ordering maintained across filters

### Technical Implementation
- Client-side filtering and search
- Memoized computations for performance
- Responsive list layout
- Real-time updates when navigating back from detail pages

---

## Messages (`/messages`)

### Overview
A comprehensive messaging system for transaction-related communication between buyers, sellers, and admins.

### Key Features

#### 1. **Conversation List**
- Displays all conversations the user is part of
- Each conversation card shows:
  - **Other Participant**: Name or email of the other user
  - **Transaction Status**: Color-coded badge showing related transaction status
  - **Transaction Title**: Title of the associated rift
  - **Last Message Preview**: Snippet of most recent message
  - **Timestamp**: Relative time (e.g., "5m ago", "2h ago")
  - **Unread Count**: Badge showing unread messages
  - **Message Indicator**: Shows "You: " prefix for user's own messages

#### 2. **Search Functionality**
- Search existing conversations by:
  - Participant name/email
  - Transaction title
- Search for new users (debounced, 300ms delay)
- Search results dropdown with user cards
- Users already in conversations filtered out

#### 3. **Real-Time Updates**
- Subscribes to new conversations via `subscribeToUserConversations()`
- Automatically refreshes when new conversations created
- Handles subscription errors gracefully (warns but doesn't crash)

#### 4. **Conversation Creation**
- Currently requires existing transaction to message
- Future enhancement: Direct messaging between users
- Error messaging guides users to create rift first

#### 5. **Status Integration**
- Transaction status displayed on each conversation
- Color-coded status indicators:
  - Green: RELEASED (completed)
  - Red: REFUNDED
  - Yellow: DISPUTED
  - Gray: CANCELLED
  - Blue: Active states

#### 6. **Empty States**
- Helpful messaging when no conversations exist
- Links to rifts page to start transactions

### Technical Implementation
- **Backend**: Supabase PostgreSQL with dedicated messaging tables
- **Real-time**: Supabase real-time subscriptions
- **Database Schema**:
  - `conversations` table
  - `conversation_participants` table
  - `messages` table with read receipts
- **API Endpoints**:
  - `GET /api/conversations` - List user conversations
  - `GET /api/conversations/[conversationId]` - Get conversation messages
  - `POST /api/conversations/[conversationId]` - Send message
  - `GET /api/conversations/transaction/[transactionId]` - Get/create conversation for transaction
- Conversation automatically created when transaction created

---

## Account (`/account`)

### Overview
User profile and account management page with verification status, dispute tracking, and support resources.

### Key Features

#### 1. **Profile Section**
Displays user information:
- **Name**: Full name (or "Not set")
- **Email**: User's email address
- **Phone**: Phone number (or "Not set")
- Edit profile button (links to `/account/edit-profile`)
- Verify email & phone button (links to `/settings/verification`)

#### 2. **Verification Status Card**
Shows verification requirements:
- **Email Verified**: Status (verified/optional)
  - Optional for web, required for mobile
  - Shows checkmark or warning icon
- **Phone Verified**: Status (verified/required)
  - Required for withdrawals
  - Shows checkmark or required indicator
  - Link to verification page if not verified

#### 3. **Disputes Section**
- Shows count of active disputes
- Link to disputes page (`/account/disputes`)
- Visual indicator for active disputes (yellow dot with count)
- Summary text explaining dispute management

#### 4. **Support & Help Center**
Links to support resources:
- **FAQ**: Frequently asked questions
- **Contact Support**: Direct support contact
- **Report a Problem**: Issue reporting

#### 5. **Admin Section** (if user is admin)
- Special admin card with purple styling
- Link to admin dashboard (`/admin`)
- Only visible to users with ADMIN role

#### 6. **Sign Out**
- Prominent sign out button
- Confirmation dialog before signing out
- Redirects to home page after signout

### Data Sources
- Profile data from `/api/auth/me`
- Dispute count from `/api/me/disputes`
- Falls back to session data if API calls fail

---

## Admin (`/admin`)

### Overview
Comprehensive administrative dashboard for managing users, transactions, disputes, and platform operations.

### Key Features

#### 1. **Summary Statistics Dashboard**
Five key metric cards:
- **Total Users**: Count of all users + admin count
- **Total Volume**: Sum of all processed amounts across users + transaction count
- **Open Disputes**: Count of disputes requiring attention
- **Pending Proofs**: Count of proofs awaiting review (links to `/admin/proofs`)
- **Verified Users**: Count of fully verified users (ID + bank) + ID verified count

#### 2. **All Users Management**
- Complete user list via `AdminUserList` component
- Displays for each user:
  - Rift User ID (public-facing ID like RIFT111111)
  - Name and email
  - Phone number
  - Role (USER/ADMIN)
  - Account stats:
    - Total processed amount
    - Available balance
    - Pending balance
    - Number of completed transactions
  - Verification status (ID verified, bank verified)
  - Transaction counts:
    - Seller transactions
    - Buyer transactions
    - Disputes raised
    - Disputes resolved
  - Average rating and response time
  - Account creation date

#### 3. **Open Disputes Management**
- List of all disputes with OPEN status
- Each dispute shows:
  - Dispute ID and reason
  - Related rift information (rift number, status)
  - Buyer and seller emails
  - Raised by user email
  - Admin notes
  - Created/updated timestamps
  - Resolution actions via `AdminDisputeList` component

#### 4. **All Transactions View**
- Complete list of all escrows via `EscrowList` component
- Shows all escrows regardless of status
- Includes buyer and seller information
- Sorted by creation date (newest first)

#### 5. **Dispute Resolution**
- Admins can resolve disputes via `/api/admin/escrows/[id]/resolve-dispute`
- Resolution options:
  - Full release to seller
  - Partial refund
  - Full refund to buyer
- Admin notes field for documentation
- Updates rift status accordingly

#### 6. **Proof Review**
- Access to pending proofs at `/admin/proofs`
- Approve or reject proofs
- Manual validation support

### Access Control
- **Route Protection**: Server-side check via `requireAdmin()` helper
- **Role Verification**: Must have ADMIN role in database
- **Automatic Redirect**: Non-admin users redirected appropriately

### Technical Implementation
- Server-side rendered (SSR) for data fetching
- Prisma queries for all data
- Efficient data loading with includes for related records
- Real-time updates via page refresh (can be enhanced with subscriptions)

---

## Wallet (`/wallet`)

### Overview
Wallet system for managing funds, viewing transaction history, and processing withdrawals.

### Key Features (from WalletCard component)

#### 1. **Balance Display**
- **Available Balance**: Funds ready for withdrawal
- **Pending Balance**: Funds awaiting release from active transactions
- Currency display (defaults to CAD)
- Formatted currency display with proper locale

#### 2. **Withdrawal Functionality**
- Withdraw button when balance > 0
- Links to `/wallet` for full withdrawal interface
- Checks withdrawal eligibility (phone verification required)
- Disabled state when no funds available

#### 3. **Ledger Entries**
- Recent transaction history (last 3 entries)
- Transaction types:
  - `CREDIT_RELEASE`: Funds released from completed rifts
  - `DEBIT_WITHDRAWAL`: Withdrawals to bank account
  - `DEBIT_CHARGEBACK`: Chargeback adjustments
  - `DEBIT_REFUND`: Refunded transactions
  - `ADJUSTMENT`: Manual adjustments
- Shows amount (positive for credits, negative for debits)
- Date of transaction
- Color coding (green for credits, red for debits)

#### 4. **View All Link**
- Links to full wallet page for complete transaction history
- Only shown if more than 3 ledger entries exist

### Wallet Data Model
- **WalletAccount**: User's wallet with available/pending balances
- **WalletLedgerEntry**: Immutable transaction log
- Linked to specific rifts where applicable
- Metadata stored as JSON for flexibility

### API Endpoints
- `GET /api/wallet` - Get wallet balance and recent entries
- `POST /api/wallet/withdraw` - Initiate withdrawal (requires phone verification)

---

## Additional Features

### 1. **Notifications System**
- **Endpoint**: `GET /api/notifications`
- Shows unread count badge on dashboard
- Special handling for Stripe status changes (KYC verification)
- Auto-refreshes every 60 seconds
- Links to relevant pages based on notification type

### 2. **Social Activity Feed**
- **Component**: `SocialFeed`
- Shows public activity feed from users who opted in
- Privacy controls:
  - `showInActivityFeed`: Opt-in to appear in feed
  - `showAmountsInFeed`: Control whether amounts are displayed
- Activity types:
  - PAYMENT_RECEIVED
  - DEAL_CLOSED
  - LEVEL_UP
  - MILESTONE_ACHIEVED
  - BADGE_EARNED
  - REPEATED_SALES_DAY
- Auto-updates every 30 seconds
- Privacy-aware name formatting (first name + last initial)

### 3. **User Levels & Gamification**
- **Level System**: 5 levels from ROOKIE → ELITE
- **XP System**: Experience points based on transactions
- **Milestones**: 7 milestone types for achievements
- **Badges**: 7 badge types for trust indicators
- Auto-awarding on transaction completion
- Displayed on dashboard and profile pages

### 4. **Risk Tiers**
- **4 Risk Tiers**: TIER0_NEW → TIER3_PRO
- Based on:
  - Account age
  - Completed rifts
  - Chargeback history
  - Dispute history
  - Total volume
- Affects payment processing and protection levels

### 5. **Item Type Protection Systems**
Four item types with different protection flows:
- **PHYSICAL**: Shipment tracking, delivery confirmation, auto-release
- **DIGITAL**: Download link verification, license key delivery
- **TICKETS**: Event date, venue, transfer method verification
- **SERVICES**: Service date confirmation, completion proof

### 6. **Hybrid Protection System**
- Combines buyer release + auto-release
- Grace period system (48 hours default)
- Auto-release if no dispute within grace period
- Manual release still available before grace period ends

### 7. **Payment Processing**
- **Stripe Integration**: Payment intents, charges, payouts
- **Fee Structure**:
  - Buyer fee: 3% of subtotal
  - Seller fee: 5% of subtotal
  - Platform fee tracking
- **Payment Intent Creation**: Before marking as paid
- **Payout System**: Stripe Connect for seller payouts

### 8. **Email Notifications**
- Transaction lifecycle emails:
  - Rift created
  - Payment received
  - Proof submitted
  - Item received
  - Funds released
  - Dispute raised
- Configurable SMTP settings

### 9. **Mobile App**
- Complete feature parity with web
- React Native (Expo) implementation
- JWT authentication
- Same API endpoints
- Native UI components with glass morphism design

### 10. **Verification System**
- Email verification (optional for web, required for mobile)
- Phone verification (required for withdrawals)
- ID verification (for risk tier upgrades)
- Bank verification (for higher limits)
- Verification code system with expiry and attempt limits

### 11. **User Search**
- Search users by name or email
- Used for creating new transactions
- Accessible via `/api/users/search`

### 12. **Rift Numbers**
- Sequential numbering system for easy reference
- Public-facing ID (e.g., RIFT123456)
- Displayed prominently in UI
- Auto-generated on rift creation

---

## API Architecture Summary

### Authentication
- NextAuth for web (session-based)
- JWT for mobile
- Unified `getAuthenticatedUser()` helper
- Role-based access control (USER/ADMIN)

### Core Endpoints

#### Escrows
- `POST /api/escrows/create` - Create new rift
- `GET /api/escrows/list` - List user's escrows
- `GET /api/escrows/[id]` - Get rift details
- `POST /api/escrows/[id]/mark-paid` - Mark payment received
- `POST /api/escrows/[id]/upload-shipment-proof` - Submit proof
- `POST /api/escrows/[id]/confirm-received` - Confirm receipt
- `POST /api/escrows/[id]/release-funds` - Release funds
- `POST /api/escrows/[id]/raise-dispute` - Open dispute
- `POST /api/escrows/[id]/cancel` - Cancel rift
- `GET /api/escrows/auto-release` - Process auto-releases (cron)

#### Messaging
- `GET /api/conversations` - List conversations
- `GET /api/conversations/[conversationId]` - Get messages
- `POST /api/conversations/[conversationId]` - Send message
- `GET /api/conversations/transaction/[transactionId]` - Get/create conversation

#### User & Account
- `GET /api/auth/me` - Get current user
- `PATCH /api/me/profile` - Update profile
- `GET /api/me/balance` - Get user balance
- `GET /api/me/disputes` - Get user disputes
- `GET /api/me/milestones` - Get milestones
- `PATCH /api/me/preferences` - Update privacy preferences
- `GET /api/users/[userId]/badges` - Get user badges

#### Wallet
- `GET /api/wallet` - Get wallet balance
- `POST /api/wallet/withdraw` - Withdraw funds

#### Admin
- `GET /api/admin/escrows` - List all escrows
- `GET /api/admin/disputes` - List all disputes
- `POST /api/admin/escrows/[id]/resolve-dispute` - Resolve dispute
- `GET /api/admin/proofs` - List pending proofs
- `POST /api/admin/proofs/[id]/approve` - Approve proof
- `POST /api/admin/proofs/[id]/reject` - Reject proof

#### Verification
- `POST /api/verify/email/send` - Send email verification code
- `POST /api/verify/email/verify` - Verify email code
- `POST /api/verify/phone/send` - Send phone verification code
- `POST /api/verify/phone/verify` - Verify phone code

---

## Database Schema Highlights

### Core Models
- **User**: Complete user profile with gamification fields
- **EscrowTransaction**: Main transaction entity with comprehensive status tracking
- **Dispute**: Dispute management with resolution tracking
- **Proof**: Flexible proof system for different item types
- **Activity**: Social activity feed entries
- **WalletAccount**: User wallet with balance tracking
- **WalletLedgerEntry**: Immutable transaction log
- **Conversation/Messages**: Messaging system (Supabase)
- **UserMilestone**: Achievement tracking
- **Badge/UserBadge**: Trust badge system
- **UserRiskProfile**: Risk tier management
- **VerificationCode**: Email/phone verification

### Key Relationships
- User → EscrowTransaction (buyer/seller)
- EscrowTransaction → Dispute (one-to-many)
- EscrowTransaction → Proof (one-to-many)
- EscrowTransaction → TimelineEvent (one-to-many)
- User → Activity (one-to-many)
- User → WalletAccount (one-to-one)
- WalletAccount → WalletLedgerEntry (one-to-many)

---

## Real-Time Features

1. **Rift Updates**: Supabase subscriptions for rift status changes
2. **Messaging**: Real-time message delivery via Supabase
3. **Conversations**: Real-time conversation list updates

---

## Design System

- **Glass Morphism**: Consistent glass card design throughout
- **Dark Theme**: Black background with subtle gradients
- **Color Coding**: Status-based color system
- **Typography**: Light font weights, minimal design
- **Responsive**: Mobile-first responsive design
- **Animations**: Subtle hover states and transitions

---

## Security Features

1. **Authentication**: Secure session and JWT management
2. **Authorization**: Role-based access control
3. **Data Isolation**: Users can only see their own data
4. **API Protection**: All endpoints require authentication
5. **Optimistic Locking**: Version field on escrows prevents race conditions
6. **Input Validation**: Comprehensive validation on all inputs
7. **SQL Injection Protection**: Prisma ORM prevents SQL injection

---

This analysis covers the complete functionality of the Rift platform across all major features and subsystems.
