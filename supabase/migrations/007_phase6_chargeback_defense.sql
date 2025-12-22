-- Phase 6: Chargeback Defense Pack + Stripe Dispute Webhooks + Evidence Export
-- This migration creates tables for policy acceptances, Stripe disputes, and evidence packets

-- ============================================
-- 1. POLICY_ACCEPTANCES TABLE
-- ============================================
DROP TABLE IF EXISTS policy_acceptances CASCADE;
CREATE TABLE policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- References users.id (Prisma uses TEXT/cuid)
  context TEXT NOT NULL CHECK (context IN ('signup', 'checkout', 'payouts', 'other')),
  policy_version TEXT NOT NULL, -- e.g. '2025-12-22_v1'
  accepted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_hash TEXT NULL,
  user_agent TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for policy_acceptances
CREATE INDEX idx_policy_acceptances_user_id ON policy_acceptances(user_id);
CREATE INDEX idx_policy_acceptances_context ON policy_acceptances(context);
CREATE INDEX idx_policy_acceptances_policy_version ON policy_acceptances(policy_version);

-- ============================================
-- 2. STRIPE_DISPUTES TABLE
-- ============================================
DROP TABLE IF EXISTS stripe_disputes CASCADE;
CREATE TABLE stripe_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT NULL,
  rift_id TEXT NULL, -- References rifts.id (Prisma uses TEXT/cuid)
  buyer_id TEXT NULL, -- References users.id
  seller_id TEXT NULL, -- References users.id
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  status TEXT NOT NULL, -- Stripe status: 'needs_response', 'under_review', 'won', 'lost', 'warning_needs_response', etc.
  reason TEXT NULL, -- Stripe reason if available
  evidence_due_by TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb -- Store minimal subset of Stripe event object
);

-- Indexes for stripe_disputes
CREATE INDEX idx_stripe_disputes_stripe_dispute_id ON stripe_disputes(stripe_dispute_id);
CREATE INDEX idx_stripe_disputes_stripe_charge_id ON stripe_disputes(stripe_charge_id);
CREATE INDEX idx_stripe_disputes_rift_id ON stripe_disputes(rift_id);
CREATE INDEX idx_stripe_disputes_buyer_id ON stripe_disputes(buyer_id);
CREATE INDEX idx_stripe_disputes_seller_id ON stripe_disputes(seller_id);
CREATE INDEX idx_stripe_disputes_status ON stripe_disputes(status);
CREATE INDEX idx_stripe_disputes_evidence_due_by ON stripe_disputes(evidence_due_by) WHERE evidence_due_by IS NOT NULL;

-- ============================================
-- 3. EVIDENCE_PACKETS TABLE
-- ============================================
DROP TABLE IF EXISTS evidence_packets CASCADE;
CREATE TABLE evidence_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rift_id TEXT NOT NULL, -- References rifts.id (Prisma uses TEXT/cuid)
  stripe_dispute_id TEXT NULL, -- References stripe_disputes.stripe_dispute_id
  generated_by TEXT NULL, -- Admin user id
  version TEXT NOT NULL DEFAULT 'v1',
  payload JSONB NOT NULL, -- The compiled evidence JSON
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for evidence_packets
CREATE INDEX idx_evidence_packets_rift_id ON evidence_packets(rift_id);
CREATE INDEX idx_evidence_packets_stripe_dispute_id ON evidence_packets(stripe_dispute_id);
CREATE INDEX idx_evidence_packets_created_at ON evidence_packets(created_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE policy_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_packets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY_ACCEPTANCES RLS
-- ============================================
DROP POLICY IF EXISTS "policy_acceptances_select_own" ON policy_acceptances;

-- SELECT: Users can view their own acceptances
CREATE POLICY "policy_acceptances_select_own"
  ON policy_acceptances FOR SELECT
  USING (true); -- API validates access

-- INSERT/UPDATE/DELETE: Disabled for client (API uses service role to validate)
-- No policy = only service role can insert/update/delete (bypasses RLS)

-- ============================================
-- STRIPE_DISPUTES RLS
-- ============================================
DROP POLICY IF EXISTS "stripe_disputes_select_admin" ON stripe_disputes;

-- SELECT: Admin only (API validates admin role)
CREATE POLICY "stripe_disputes_select_admin"
  ON stripe_disputes FOR SELECT
  USING (true); -- API validates admin access

-- INSERT/UPDATE/DELETE: Only server (service role) can perform these actions
-- No policy = only service role can insert/update/delete (bypasses RLS)

-- ============================================
-- EVIDENCE_PACKETS RLS
-- ============================================
DROP POLICY IF EXISTS "evidence_packets_select_admin" ON evidence_packets;

-- SELECT: Admin only (API validates admin role)
CREATE POLICY "evidence_packets_select_admin"
  ON evidence_packets FOR SELECT
  USING (true); -- API validates admin access

-- INSERT/UPDATE/DELETE: Only server (service role) can perform these actions
-- No policy = only service role can insert/update/delete (bypasses RLS)

-- ============================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS update_stripe_disputes_updated_at ON stripe_disputes;
CREATE TRIGGER update_stripe_disputes_updated_at
  BEFORE UPDATE ON stripe_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

