-- Phase 4: High-friction Disputes + Auto-triage + Admin Review Queue
-- This migration creates the dispute system tables

-- ============================================
-- 1. DISPUTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rift_id TEXT NOT NULL, -- References rift transaction ID (managed by Prisma)
  opened_by TEXT NOT NULL, -- User ID (TEXT to match Prisma User.id)
  status TEXT NOT NULL CHECK (status IN (
    'draft',
    'submitted',
    'needs_info',
    'under_review',
    'auto_rejected',
    'resolved_buyer',
    'resolved_seller',
    'rejected',
    'canceled'
  )),
  reason TEXT NOT NULL CHECK (reason IN (
    'not_received',
    'not_as_described',
    'unauthorized',
    'seller_nonresponsive',
    'other'
  )),
  category_snapshot TEXT NOT NULL, -- Snapshot of rift.itemType at time of dispute
  sworn_declaration BOOLEAN NOT NULL DEFAULT FALSE,
  sworn_declaration_text TEXT, -- Store short acknowledgement string
  summary TEXT NOT NULL DEFAULT '', -- User-provided summary
  auto_triage JSONB NOT NULL DEFAULT '{}'::jsonb, -- {eligible:boolean, decision:'auto_reject'|'needs_review', signals:{...}}
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Note: We allow multiple disputes per rift, but API will enforce only one active dispute
-- (status in 'draft', 'submitted', 'needs_info', 'under_review') at a time

-- Indexes for disputes
CREATE INDEX IF NOT EXISTS idx_disputes_rift_id ON disputes(rift_id);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON disputes(opened_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_reason ON disputes(reason);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at);

-- ============================================
-- 2. DISPUTE_EVIDENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL, -- User ID
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('buyer', 'seller', 'system', 'admin')),
  type TEXT NOT NULL CHECK (type IN ('image', 'pdf', 'text', 'link', 'file')),
  storage_path TEXT, -- For file evidence (Supabase storage path)
  text_content TEXT, -- For type='text' or 'link'
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for dispute_evidence
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_uploader_id ON dispute_evidence(uploader_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_type ON dispute_evidence(type);

-- ============================================
-- 3. DISPUTE_ACTIONS TABLE (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS dispute_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  actor_id TEXT, -- User ID (nullable for system actions)
  actor_role TEXT NOT NULL CHECK (actor_role IN ('buyer', 'seller', 'system', 'admin')),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created',
    'submitted',
    'requested_info',
    'evidence_added',
    'auto_rejected',
    'moved_to_review',
    'resolved_buyer',
    'resolved_seller',
    'rejected',
    'canceled'
  )),
  note TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for dispute_actions
CREATE INDEX IF NOT EXISTS idx_dispute_actions_dispute_id ON dispute_actions(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_actions_actor_id ON dispute_actions(actor_id);
CREATE INDEX IF NOT EXISTS idx_dispute_actions_action_type ON dispute_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_dispute_actions_created_at ON dispute_actions(created_at);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_actions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DISPUTES RLS
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "disputes_select_buyer_seller" ON disputes;
DROP POLICY IF EXISTS "disputes_insert_buyer" ON disputes;
DROP POLICY IF EXISTS "disputes_update_buyer" ON disputes;
DROP POLICY IF EXISTS "disputes_select_authenticated" ON disputes;

-- SELECT: Allow authenticated users (API validates buyer/seller access)
CREATE POLICY "disputes_select_authenticated"
  ON disputes FOR SELECT
  USING (true); -- API validates access

-- INSERT: Disabled for client (API uses service role to validate buyer)
-- No policy = only service role can insert (bypasses RLS)

-- UPDATE: Disabled for client (API uses service role to validate buyer/seller/admin)
-- No policy = only service role can update (bypasses RLS)

-- ============================================
-- DISPUTE_EVIDENCE RLS
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "dispute_evidence_select_buyer_seller" ON dispute_evidence;
DROP POLICY IF EXISTS "dispute_evidence_insert_buyer_seller" ON dispute_evidence;
DROP POLICY IF EXISTS "dispute_evidence_select_authenticated" ON dispute_evidence;

-- SELECT: Allow authenticated users (API validates buyer/seller access)
CREATE POLICY "dispute_evidence_select_authenticated"
  ON dispute_evidence FOR SELECT
  USING (true); -- API validates access

-- INSERT: Disabled for client (API uses service role to validate buyer/seller)
-- No policy = only service role can insert (bypasses RLS)

-- UPDATE/DELETE: Disabled for clients
-- No policy = only service role can update/delete (bypasses RLS)

-- ============================================
-- DISPUTE_ACTIONS RLS
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "dispute_actions_select_buyer_seller" ON dispute_actions;
DROP POLICY IF EXISTS "dispute_actions_select_authenticated" ON dispute_actions;

-- SELECT: Allow authenticated users (API validates buyer/seller access)
CREATE POLICY "dispute_actions_select_authenticated"
  ON dispute_actions FOR SELECT
  USING (true); -- API validates access

-- INSERT: Server/admin only (audit trail)
-- No policy = only service role can insert (bypasses RLS)

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================
-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_disputes_updated_at ON disputes;

-- Create trigger for disputes.updated_at
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON disputes
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
--    routes validate buyer/seller/admin access before allowing operations.
-- 4. The unique constraint on (rift_id, status) is deferred to allow multiple
--    disputes per rift (e.g., one canceled, one active).

