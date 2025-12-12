# Messaging System Upgrade - Complete Implementation

This document describes the complete realtime messaging system upgrade that has been implemented.

## Overview

The messaging system has been upgraded to use:
- **UUID-based schema** with proper `conversation_participants` table
- **Realtime subscriptions** using Supabase Realtime
- **Full CRUD operations** with proper authentication
- **Both mobile and web** support

## Database Schema

### Tables

1. **conversations**
   - `id` (UUID, PK)
   - `created_at` (TIMESTAMPTZ)
   - `last_message_at` (TIMESTAMPTZ, nullable)

2. **conversation_participants**
   - `id` (UUID, PK)
   - `conversation_id` (UUID, FK → conversations.id)
   - `user_id` (TEXT, matches Prisma User.id)
   - `role` (TEXT: 'buyer', 'seller', 'admin')
   - Unique constraint on (conversation_id, user_id)

3. **messages**
   - `id` (UUID, PK)
   - `conversation_id` (UUID, FK → conversations.id)
   - `sender_id` (TEXT, matches Prisma User.id)
   - `body` (TEXT)
   - `created_at` (TIMESTAMPTZ)
   - `read_at` (TIMESTAMPTZ, nullable)

### Migration

Run the migration file:
```bash
# If using Supabase CLI
supabase migration up

# Or apply manually via Supabase dashboard SQL editor
# File: supabase/migrations/002_upgrade_messaging_schema.sql
```

## Backend API Routes

### GET `/api/conversations`
Lists all conversations for the authenticated user.

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "transactionId": "string | null",
      "transactionTitle": "string",
      "transactionStatus": "string | null",
      "otherParticipant": { "id": "string", "name": "string", "email": "string" } | null,
      "lastMessage": { "id": "string", "body": "string", "senderId": "string", "createdAt": "string" } | null,
      "updatedAt": "string",
      "unreadCount": 0
    }
  ]
}
```

### GET `/api/conversations/transaction/[transactionId]`
Gets or creates a conversation for a transaction and returns all messages.

**Response:**
```json
{
  "conversation": {
    "id": "uuid",
    "createdAt": "string",
    "lastMessageAt": "string | null"
  },
  "messages": [
    {
      "id": "uuid",
      "body": "string",
      "senderId": "string | null",
      "createdAt": "string",
      "readAt": "string | null"
    }
  ]
}
```

### POST `/api/conversations/transaction/[transactionId]`
Sends a new message to a conversation (creates conversation if it doesn't exist).

**Request:**
```json
{
  "body": "message text"
}
```

**Response:**
```json
{
  "id": "uuid",
  "body": "string",
  "senderId": "string | null",
  "createdAt": "string",
  "readAt": "string | null"
}
```

### GET `/api/conversations/[conversationId]`
Gets a conversation by ID (with auth check).

### POST `/api/conversations/[conversationId]`
Sends a message to a conversation by ID.

## Realtime Subscriptions

### Web (`lib/realtime-messaging.ts`)

- `subscribeToMessages(conversationId, onMessage, onError)` - Subscribe to new messages
- `subscribeToConversation(conversationId, onUpdate, onError)` - Subscribe to conversation updates
- `subscribeToUserConversations(userId, onNewConversation, onError)` - Subscribe to new conversations

### Mobile (`mobile/lib/realtime-messaging.ts`)

Same API as web version.

## Frontend Components

### Web Components

1. **`components/MessagingPanel.tsx`**
   - Displays messages for a transaction
   - Sends messages
   - Subscribes to realtime updates
   - Used in `/app/escrows/[id]/page.tsx`

2. **`app/messages/page.tsx`**
   - Lists all conversations
   - Links to transaction detail pages
   - Subscribes to new conversations

### Mobile Components

1. **`mobile/components/MessagingPanel.tsx`**
   - Same functionality as web version
   - Used in escrow detail screens

2. **`mobile/app/messages/[id].tsx`**
   - Full-screen conversation view
   - Realtime message updates
   - Send messages

3. **`mobile/app/(tabs)/messages.tsx`**
   - Conversation list
   - Realtime updates for new conversations

## Setup Instructions

### 1. Environment Variables

Ensure these are set:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# For mobile (in app.json or expo config)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Run Migration

Apply the database migration:
```bash
# Via Supabase CLI
supabase migration up

# Or via Supabase Dashboard SQL Editor
# Copy contents of supabase/migrations/002_upgrade_messaging_schema.sql
```

### 3. Install Dependencies

For mobile app, ensure `@supabase/supabase-js` is installed:
```bash
cd mobile
npm install @supabase/supabase-js
```

### 4. Enable Realtime in Supabase

1. Go to Supabase Dashboard
2. Navigate to Database → Replication
3. Enable replication for:
   - `conversations` table
   - `messages` table
   - `conversation_participants` table

Or use the SQL commands in the migration (they're wrapped in a DO block to handle cases where the publication doesn't exist).

## Features

✅ **Full CRUD operations** - Create, read, send messages
✅ **Realtime updates** - Messages appear instantly without polling
✅ **Authentication** - All endpoints check user authentication
✅ **Authorization** - Users can only access conversations they're participants in
✅ **Optimistic updates** - UI updates immediately, then syncs with server
✅ **Error handling** - Graceful error handling throughout
✅ **Mobile & Web** - Works on both platforms

## Usage Examples

### Web - Using MessagingPanel

```tsx
import MessagingPanel from '@/components/MessagingPanel'

<MessagingPanel transactionId={escrow.id} />
```

### Mobile - Using MessagingPanel

```tsx
import MessagingPanel from '@/components/MessagingPanel'

<MessagingPanel transactionId={escrow.id} />
```

### Web - Using Realtime Hooks Directly

```tsx
import { subscribeToMessages } from '@/lib/realtime-messaging'

useEffect(() => {
  const unsubscribe = subscribeToMessages(
    conversationId,
    (newMessage) => {
      setMessages(prev => [...prev, newMessage])
    }
  )
  
  return () => unsubscribe()
}, [conversationId])
```

## Notes

- The system automatically creates conversations when a message is sent to a transaction
- Participants are automatically added (buyer, seller, and optionally admin)
- `last_message_at` is automatically updated via database trigger
- All queries are scoped to authenticated users
- The system supports one conversation per transaction (buyer + seller + optional admin)

## Troubleshooting

### Realtime not working?

1. Check that Realtime is enabled in Supabase Dashboard
2. Verify environment variables are set correctly
3. Check browser console for subscription errors
4. Ensure the Supabase client is properly initialized

### Messages not appearing?

1. Check authentication - ensure user is logged in
2. Verify user is a participant in the conversation
3. Check network tab for API errors
4. Verify database migration was applied successfully

### Mobile app issues?

1. Ensure `@supabase/supabase-js` is installed in mobile directory
2. Check that environment variables are accessible in Expo
3. Verify Supabase URL and keys are correct

