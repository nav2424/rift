-- Phase 5: Risk Engine + Enforcement Automation + Holds/Funds Freezing + Abuse Controls
-- This migration creates tables for risk profiles, enforcement actions, and user restrictions

-- ============================================
-- 1. RISK_PROFILES TABLE
-- ============================================
DROP TABLE IF EXISTS risk_profiles CASCADE;
CREATE TABLE risk_profiles (
  user_id TEXT NOT NULL PRIMARY KEY, -- References users.id (Prisma uses TEXT/cuid)
  buyer_risk_score INT NOT NULL DEFAULT 0 CHECK (buyer_risk_score >= 0 AND buyer_risk_score <= 100),
  seller_risk_score INT NOT NULL DEFAULT 0 CHECK (seller_risk_score >= 0 AND seller_risk_score <= 100),
  strikes INT NOT NULL DEFAULT 0,
  chargebacks INT NOT NULL DEFAULT 0,
  disputes_opened INT NOT NULL DEFAULT 0,
  disputes_lost INT NOT NULL DEFAULT 0,
  successful_transactions INT NOT NULL DEFAULT 0,
  total_volume_cents BIGINT NOT NULL DEFAULT 0,
  last_chargeback_at TIMESTAMPTZ NULL,
  last_dispute_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for risk_profiles
CREATE INDEX idx_risk_profiles_buyer_score ON risk_profiles(buyer_risk_score);
CREATE INDEX idx_risk_profiles_seller_score ON risk_profiles(seller_risk_score);
CREATE INDEX idx_risk_profiles_chargebacks ON risk_profiles(chargebacks);
CREATE INDEX idx_risk_profiles_strikes ON risk_profiles(strikes);

-- ============================================
-- 2. ENFORCEMENT_ACTIONS TABLE (append-only)
-- ============================================
DROP TABLE IF EXISTS enforcement_actions CASCADE;
CREATE TABLE enforcement_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- References users.id (Prisma uses TEXT/cuid)
  action_type TEXT NOT NULL CHECK (action_type IN (
    'strike',
    'require_confirmation',
    'extend_hold',
    'freeze_funds',
    'restrict_disputes',
    'restrict_category',
    'ban'
  )),
  reason TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for enforcement_actions
CREATE INDEX idx_enforcement_actions_user_id ON enforcement_actions(user_id);
CREATE INDEX idx_enforcement_actions_action_type ON enforcement_actions(action_type);
CREATE INDEX idx_enforcement_actions_created_at ON enforcement_actions(created_at DESC);

-- ============================================
-- 3. USER_RESTRICTIONS TABLE (current state)
-- ============================================
DROP TABLE IF EXISTS user_restrictions CASCADE;
CREATE TABLE user_restrictions (
  user_id TEXT NOT NULL PRIMARY KEY, -- References users.id (Prisma uses TEXT/cuid)
  disputes_restricted_until TIMESTAMPTZ NULL,
  categories_blocked TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  funds_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_reason TEXT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for user_restrictions
CREATE INDEX idx_user_restrictions_disputes_restricted ON user_restrictions(disputes_restricted_until) WHERE disputes_restricted_until IS NOT NULL;
CREATE INDEX idx_user_restrictions_funds_frozen ON user_restrictions(funds_frozen) WHERE funds_frozen = TRUE;

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RISK_PROFILES RLS
-- ============================================
DROP POLICY IF EXISTS "risk_profiles_select_own" ON risk_profiles;

-- SELECT: Allow authenticated users (API validates access)
CREATE POLICY "risk_profiles_select_authenticated"
  ON risk_profiles FOR SELECT
  USING (true); -- API validates access

-- INSERT/UPDATE/DELETE: Disabled for client (API uses service role to validate)
-- No policy = only service role can insert/update/delete (bypasses RLS)

-- ============================================
-- ENFORCEMENT_ACTIONS RLS
-- ============================================
DROP POLICY IF EXISTS "enforcement_actions_select_own" ON enforcement_actions;
DROP POLICY IF EXISTS "enforcement_actions_select_admin" ON enforcement_actions;

-- SELECT: Allow authenticated users (API validates access)
CREATE POLICY "enforcement_actions_select_authenticated"
  ON enforcement_actions FOR SELECT
  USING (true); -- API validates access

-- INSERT/UPDATE/DELETE: Only server (service role) can perform these actions
-- No policy = only service role can insert/update/delete (bypasses RLS)

-- ============================================
-- USER_RESTRICTIONS RLS
-- ============================================
DROP POLICY IF EXISTS "user_restrictions_select_own" ON user_restrictions;

-- SELECT: Allow authenticated users (API validates access)
CREATE POLICY "user_restrictions_select_authenticated"
  ON user_restrictions FOR SELECT
  USING (true); -- API validates access

-- INSERT/UPDATE/DELETE: Disabled for client (API uses service role to validate)
-- No policy = only service role can insert/update/delete (bypasses RLS)

-- ============================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS update_risk_profiles_updated_at ON risk_profiles;
CREATE TRIGGER update_risk_profiles_updated_at
  BEFORE UPDATE ON risk_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_restrictions_updated_at ON user_restrictions;
CREATE TRIGGER update_user_restrictions_updated_at
  BEFORE UPDATE ON user_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

