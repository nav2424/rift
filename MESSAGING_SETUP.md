# Messaging System Setup Guide

This guide will help you set up the in-app messaging system for your escrow marketplace.

## Prerequisites

1. **Supabase Account**: You need a Supabase project with Postgres database
2. **Environment Variables**: Configure Supabase credentials

## Setup Steps

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important**: 
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public and safe to expose
- `SUPABASE_SERVICE_ROLE_KEY` is secret and should NEVER be exposed to the client

### 3. Run Database Migration

The migration file is located at `supabase/migrations/001_create_messaging_tables.sql`.

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/001_create_messaging_tables.sql`
4. **Important**: Before running, update the foreign key references:
   - If your transactions table is named `transactions`, keep as is
   - If your transactions table is named `EscrowTransaction` or something else, update line 11:
     ```sql
     CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES "EscrowTransaction"(id) ON DELETE CASCADE,
     ```
   - Similarly, if your users table is not in `auth.users`, update lines 12, 13, and 26
5. Run the SQL

**Option B: Using Supabase CLI**
```bash
supabase db push
```

### 4. Verify Tables Created

After running the migration, verify that these tables exist:
- `conversations` - One per transaction
- `messages` - All messages in conversations

You can check in Supabase Dashboard > Table Editor.

### 5. Test the Messaging System

1. Start your development server: `npm run dev`
2. Navigate to a transaction detail page in the mobile app
3. You should see the "Messages" panel
4. Try sending a message between buyer and seller

## Architecture

### Database Schema

**conversations**
- One conversation per transaction (enforced by unique constraint on `transaction_id`)
- Links buyer and seller
- Automatically updated when messages are added

**messages**
- All messages in a conversation
- Supports system messages (for escrow events)
- Indexed for fast retrieval

### API Routes

- `GET /api/conversations/[transactionId]` - Fetch or create conversation + messages
- `POST /api/conversations/[transactionId]` - Send a new message

### Security

- Row Level Security (RLS) policies ensure users can only:
  - View conversations they're part of (as buyer or seller)
  - Send messages in their conversations
- API routes validate user authentication and transaction access

## Features

✅ One conversation per transaction  
✅ Text-only messages  
✅ Real-time polling (every 8 seconds)  
✅ System message support (for escrow events)  
✅ Optimistic UI updates  
✅ Error handling  

## Future Enhancements

- WebSocket support for real-time updates
- Push notifications
- File attachments
- Typing indicators
- Message reactions

## Troubleshooting

### "Supabase configuration missing" error
- Check that all environment variables are set correctly
- Restart your development server after adding env vars

### "Transaction not found" error
- Ensure the transaction exists in your database
- Verify the user is either buyer or seller

### Messages not appearing
- Check browser console for errors
- Verify RLS policies are enabled in Supabase
- Check that the user is authenticated

### Foreign key constraint errors
- Update the migration SQL to match your actual table names
- Ensure the transactions table exists before running the migration

