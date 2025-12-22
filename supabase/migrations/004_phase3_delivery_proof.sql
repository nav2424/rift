-- Phase 3: Delivery Proof by Category + Release Gating + Auto Rules
-- This migration creates tables for digital deliveries, delivery views, and ticket transfers

-- ============================================
-- 1. DIGITAL DELIVERIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS digital_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rift_id TEXT NOT NULL, -- References rift transaction ID (managed by Prisma)
  storage_path TEXT NOT NULL, -- Supabase storage key
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL, -- User ID (TEXT to match Prisma User.id)
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  viewer_enabled BOOLEAN DEFAULT TRUE,
  
  -- Ensure one delivery per rift
  CONSTRAINT unique_rift_delivery UNIQUE (rift_id)
);

-- Indexes for digital_deliveries
CREATE INDEX IF NOT EXISTS idx_digital_deliveries_rift_id ON digital_deliveries(rift_id);
CREATE INDEX IF NOT EXISTS idx_digital_deliveries_uploaded_by ON digital_deliveries(uploaded_by);

-- ============================================
-- 2. DELIVERY VIEWS TABLE (Engagement Proof)
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rift_id TEXT NOT NULL,
  viewer_session_id UUID NOT NULL,
  buyer_id TEXT NOT NULL, -- User ID (TEXT to match Prisma User.id)
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMPTZ,
  seconds_viewed INT DEFAULT 0,
  downloaded BOOLEAN DEFAULT FALSE,
  last_event_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  
  -- One session per buyer per rift (can have multiple sessions over time)
  CONSTRAINT unique_viewer_session UNIQUE (viewer_session_id)
);

-- Indexes for delivery_views
CREATE INDEX IF NOT EXISTS idx_delivery_views_rift_id ON delivery_views(rift_id);
CREATE INDEX IF NOT EXISTS idx_delivery_views_buyer_id ON delivery_views(buyer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_views_session_id ON delivery_views(viewer_session_id);
CREATE INDEX IF NOT EXISTS idx_delivery_views_downloaded ON delivery_views(downloaded);

-- ============================================
-- 3. TICKET TRANSFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rift_id TEXT NOT NULL, -- References rift transaction ID (managed by Prisma)
  provider TEXT NOT NULL CHECK (provider IN ('ticketmaster', 'axs', 'seatgeek', 'stubhub', 'other')),
  transfer_to_email TEXT NOT NULL,
  seller_claimed_sent_at TIMESTAMPTZ,
  buyer_confirmed_received_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'seller_sent', 'buyer_confirmed', 'expired', 'disputed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one transfer record per rift
  CONSTRAINT unique_rift_transfer UNIQUE (rift_id)
);

-- Indexes for ticket_transfers
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_rift_id ON ticket_transfers(rift_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_status ON ticket_transfers(status);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_provider ON ticket_transfers(provider);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE digital_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_transfers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DIGITAL_DELIVERIES RLS
-- ============================================

-- Drop existing policies if they exist (in case migration was partially applied)
DROP POLICY IF EXISTS "digital_deliveries_select_buyer_seller" ON digital_deliveries;
DROP POLICY IF EXISTS "digital_deliveries_insert_seller" ON digital_deliveries;
DROP POLICY IF EXISTS "digital_deliveries_update_seller" ON digital_deliveries;
DROP POLICY IF EXISTS "digital_deliveries_select_authenticated" ON digital_deliveries;

-- Note: RLS policies are simplified. Access control is enforced at the API level
-- using service role for server operations. These policies provide basic protection.

-- SELECT: Allow authenticated users (API validates buyer/seller access)
CREATE POLICY "digital_deliveries_select_authenticated"
  ON digital_deliveries FOR SELECT
  USING (true); -- API validates access

-- INSERT: Disabled for client (API uses service role)
-- No policy = only service role can insert (bypasses RLS)

-- UPDATE: Disabled for client (API uses service role)
-- No policy = only service role can update (bypasses RLS)

-- DELETE: Only server (service role) can delete
-- No policy = only service role can delete (bypasses RLS)

-- ============================================
-- DELIVERY_VIEWS RLS
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "delivery_views_select_buyer_seller" ON delivery_views;
DROP POLICY IF EXISTS "delivery_views_insert_buyer" ON delivery_views;
DROP POLICY IF EXISTS "delivery_views_select_authenticated" ON delivery_views;

-- SELECT: Allow authenticated users (API validates buyer/seller access)
CREATE POLICY "delivery_views_select_authenticated"
  ON delivery_views FOR SELECT
  USING (true); -- API validates access

-- INSERT: Disabled for client (API uses service role to validate buyer)
-- No policy = only service role can insert (bypasses RLS)

-- UPDATE: Only server can update (to prevent client from faking seconds_viewed)
-- No policy = only service role can update (bypasses RLS)

-- ============================================
-- TICKET_TRANSFERS RLS
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "ticket_transfers_select_buyer_seller" ON ticket_transfers;
DROP POLICY IF EXISTS "ticket_transfers_insert_buyer_seller" ON ticket_transfers;
DROP POLICY IF EXISTS "ticket_transfers_update_buyer_seller" ON ticket_transfers;
DROP POLICY IF EXISTS "ticket_transfers_select_authenticated" ON ticket_transfers;

-- SELECT: Allow authenticated users (API validates buyer/seller access)
CREATE POLICY "ticket_transfers_select_authenticated"
  ON ticket_transfers FOR SELECT
  USING (true); -- API validates access

-- INSERT: Disabled for client (API uses service role to validate buyer/seller)
-- No policy = only service role can insert (bypasses RLS)

-- UPDATE: Disabled for client (API uses service role to validate buyer/seller)
-- No policy = only service role can update (bypasses RLS)

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================
-- Drop trigger if it exists (in case migration was partially applied)
DROP TRIGGER IF EXISTS update_ticket_transfers_updated_at ON ticket_transfers;

-- Create or replace the function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER update_ticket_transfers_updated_at
  BEFORE UPDATE ON ticket_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES:
-- ============================================
-- 1. RLS policies are simplified. Access control is enforced at the API level
--    using service role for server operations.
-- 2. Foreign keys to rift transactions are not enforced at DB level since
--    they're managed by Prisma. We validate at the API level.
-- 3. All INSERT/UPDATE operations use service role (bypasses RLS) and API
--    routes validate buyer/seller access before allowing operations.
-- 4. For production, consider adding:
--    - Soft deletes (deleted_at columns)
--    - Audit logging
--    - Rate limiting on delivery_views updates
