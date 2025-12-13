# Real-Time Sync Architecture

This document describes how data synchronization works between the website and mobile app to ensure 24/7 real-time sync.

## Overview

Both the website and mobile app share the same database and API endpoints, ensuring that all data (users, messages, escrows/rifts) is always in sync across platforms.

## Authentication

### Website (Next.js)
- Uses **NextAuth** with session-based authentication
- Sessions stored in HTTP-only cookies
- Authenticated via `getServerSession()` in API routes

### Mobile App (React Native)
- Uses **JWT tokens** stored in Expo SecureStore
- Tokens sent in `Authorization: Bearer <token>` header
- Authenticated via JWT verification in API routes

### Unified Authentication Middleware
The `getAuthenticatedUser()` function in `lib/mobile-auth.ts` handles both:
1. **JWT authentication** (mobile) - checks `Authorization` header
2. **Session authentication** (web) - falls back to NextAuth session

Both methods authenticate against the same `User` table in the database.

## Data Storage

All data is stored in a **single PostgreSQL database** accessed via Prisma:
- **Users**: Single source of truth in `User` table
- **Escrows/Rifts**: Single source of truth in `EscrowTransaction` table
- **Messages**: Stored in Supabase PostgreSQL (same database)

## Real-Time Synchronization

### Messages
✅ **Already implemented** using Supabase Realtime
- Both platforms subscribe to message changes via `subscribeToMessages()`
- Real-time updates when messages are sent/received
- Works for both web and mobile

### Escrows/Rifts
✅ **Now implemented** using Supabase Realtime
- Both platforms subscribe to escrow updates via `subscribeToUserEscrows()`
- Real-time updates when:
  - Escrow status changes
  - New escrows are created
  - Escrow details are updated
- Mobile detail pages also subscribe to individual escrow updates

### User Profiles
- User data is fetched from the same API endpoints
- Profile updates are immediately reflected (user makes the change themselves)
- Both platforms use `/api/auth/me` and `/api/me/profile` endpoints

## API Endpoints

All API endpoints support both authentication methods:

### Shared Endpoints
- `/api/escrows/list` - List user's escrows (works for both)
- `/api/escrows/[id]` - Get escrow details (works for both)
- `/api/escrows/create` - Create new escrow (works for both)
- `/api/conversations` - List conversations (works for both)
- `/api/conversations/[id]` - Get/send messages (works for both)
- `/api/auth/me` - Get current user (works for both)
- `/api/me/profile` - Update profile (works for both)

### Mobile-Specific Endpoints
- `/api/auth/mobile-signin` - Mobile sign in (returns JWT)
- `/api/auth/mobile-signup` - Mobile sign up (returns JWT)

### Web-Specific Endpoints
- `/api/auth/[...nextauth]` - NextAuth endpoints (session-based)

## Real-Time Sync Implementation

### Escrow Sync
```typescript
// Both platforms use the same function
import { subscribeToUserEscrows } from '@/lib/realtime-escrows'

subscribeToUserEscrows(
  userId,
  (update) => {
    // Update escrow in UI
  },
  (newEscrow) => {
    // Add new escrow to list
  }
)
```

### Message Sync
```typescript
// Both platforms use the same function
import { subscribeToMessages } from '@/lib/realtime-messaging'

subscribeToMessages(
  conversationId,
  (message) => {
    // Add message to UI
  }
)
```

## How It Works

1. **User signs in** on either platform
   - Website: Creates NextAuth session
   - Mobile: Receives JWT token
   - Both authenticate against same `User` table

2. **User creates/updates data** on either platform
   - Changes are written to the shared database
   - Supabase Realtime triggers notify all subscribers

3. **Other platform receives updates**
   - Real-time subscriptions detect changes
   - UI updates automatically without refresh
   - User sees changes instantly

4. **Data consistency**
   - Single source of truth (database)
   - No local caching conflicts
   - Both platforms always show the same data

## Configuration

### Required Environment Variables

**Website:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (for realtime)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (for realtime)

**Mobile:**
- `API_URL` - Backend API URL (in `app.json`)
- Supabase config (same as website, in `app.json` or env)

**Backend:**
- `JWT_SECRET` - JWT signing secret (for mobile auth)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for server operations)

## Testing Sync

1. **Sign in on website** - Create an escrow
2. **Open mobile app** - Escrow should appear automatically (via realtime)
3. **Update escrow on mobile** - Website should update automatically
4. **Send message on website** - Mobile should receive it in real-time
5. **Update profile on mobile** - Website should reflect changes on next page load

## Troubleshooting

### Sync not working?
1. Check Supabase configuration (URL and keys)
2. Verify database connection
3. Check browser console / mobile logs for subscription errors
4. Ensure Supabase Realtime is enabled for your tables

### Authentication issues?
1. Verify JWT_SECRET is set (for mobile)
2. Verify NEXTAUTH_SECRET is set (for web)
3. Check that both use the same database

### Data not syncing?
1. Check that Supabase Realtime is enabled
2. Verify table names match (case-sensitive)
3. Check network connectivity
4. Verify user is authenticated on both platforms

## Future Enhancements

- [ ] Add real-time sync for user profile updates
- [ ] Add optimistic updates for better UX
- [ ] Add conflict resolution for concurrent edits
- [ ] Add offline support with sync on reconnect

