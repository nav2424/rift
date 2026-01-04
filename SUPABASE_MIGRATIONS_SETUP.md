# Supabase Migrations Setup Guide

## Problem

You're seeing errors like:
- `Could not find the table 'public.conversation_participants' in the schema cache`
- `Could not find the table 'public.disputes' in the schema cache`
- `Could not find the table 'public.risk_profiles' in the schema cache`

This means the Supabase database tables haven't been created yet. The migrations exist in `supabase/migrations/` but need to be applied to your Supabase database.

## Solution: Apply Supabase Migrations

Supabase migrations are **separate** from Prisma migrations. You need to apply them through the Supabase Dashboard.

### Step 1: Go to Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)

### Step 2: Apply Migrations in Order

Run each migration file in order. **Important**: Run them in the exact order listed below.

#### Migration 1: Messaging Tables (002_upgrade_messaging_schema.sql)

This creates the messaging system tables including `conversation_participants`.

1. Open `supabase/migrations/002_upgrade_messaging_schema.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Verify success - you should see "Success. No rows returned"

#### Migration 2: Disputes Tables (005_phase4_disputes.sql)

This creates the disputes system tables.

1. Open `supabase/migrations/005_phase4_disputes.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**
5. Verify success

#### Migration 3: Risk Engine Tables (006_phase5_risk_engine.sql)

This creates the risk profiles and enforcement tables.

1. Open `supabase/migrations/006_phase5_risk_engine.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**
5. Verify success

#### Migration 4: Chargeback Defense (007_phase6_chargeback_defense.sql)

This creates Stripe disputes tracking tables (optional but recommended).

1. Open `supabase/migrations/007_phase6_chargeback_defense.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**
5. Verify success

### Step 3: Verify Tables Were Created

In Supabase Dashboard:

1. Go to **Table Editor** (in the left sidebar)
2. You should now see these tables:
   - ✅ `conversation_participants`
   - ✅ `conversations`
   - ✅ `messages`
   - ✅ `disputes`
   - ✅ `dispute_evidence`
   - ✅ `dispute_actions`
   - ✅ `risk_profiles`
   - ✅ `enforcement_actions`
   - ✅ `stripe_disputes` (if you ran migration 4)

### Step 4: Test Your Application

After applying the migrations:

1. Restart your development server (if running locally)
2. The errors should be resolved
3. Test the features that use these tables:
   - Messaging/conversations
   - Disputes system
   - Risk scoring

## Alternative: Using Terminal Script (Recommended for Terminal Users)

If you prefer to run migrations from the terminal, use the provided script:

### Option 1: Using Node.js Script

```bash
# Make sure DATABASE_URL is set (from .env.local or environment)
export DATABASE_URL="postgresql://user:password@host:port/database"

# Or if using .env.local, source it first
source .env.local

# Run the migration script
node scripts/apply-supabase-migrations.js
```

### Option 2: Using Shell Script (Bash)

```bash
# Make sure DATABASE_URL is set
export DATABASE_URL="postgresql://user:password@host:port/database"

# Or source .env.local
source .env.local

# Run the migration script
./scripts/apply-supabase-migrations-psql.sh
```

**Requirements:**
- `psql` (PostgreSQL client) must be installed
  - macOS: `brew install postgresql`
  - Ubuntu/Debian: `sudo apt-get install postgresql-client`
  - Windows: Install PostgreSQL from https://www.postgresql.org/download/
- `DATABASE_URL` environment variable must be set

**Note**: These scripts use `psql` to connect directly to your database. They're equivalent to running the SQL files manually but automated.

## Alternative: Using Supabase CLI (Advanced)

If you have Supabase CLI installed and linked to your project:

```bash
# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

**Note**: This requires Supabase CLI setup, which is more complex. Using the Dashboard SQL Editor (Step 2 above) or the terminal scripts is recommended for most users.

## Troubleshooting

### Error: "relation already exists"
- The table already exists - you can skip that migration
- Or drop the table first if you want to recreate it (be careful - this deletes data!)

### Error: "permission denied"
- Make sure you're using the SQL Editor (not a read-only view)
- Verify you have admin access to the Supabase project

### Error: "function does not exist"
- Some migrations depend on functions from previous migrations
- Make sure you're running migrations in order (002 → 005 → 006 → 007)

### Tables still not found after migration
- Wait a few seconds - PostgREST cache can take a moment to refresh
- Check Table Editor to verify tables were actually created
- Verify you're connecting to the correct Supabase project (check environment variables)

## Migration Order Reference

Run migrations in this exact order:

1. `002_upgrade_messaging_schema.sql` - Messaging system
2. `005_phase4_disputes.sql` - Disputes system  
3. `006_phase5_risk_engine.sql` - Risk profiles
4. `007_phase6_chargeback_defense.sql` - Stripe disputes (optional)

**Note**: Migrations 001, 003, and 004 are either deprecated or have been superseded by later migrations.

## After Migration

Once migrations are applied, your application should work correctly. The errors you were seeing should disappear.

If you still see errors:
1. Verify environment variables are set correctly:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Restart your development server
3. Check the Supabase Dashboard → Table Editor to confirm tables exist

