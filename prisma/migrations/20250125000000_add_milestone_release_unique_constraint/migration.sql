-- Add unique constraint to prevent duplicate milestone releases
-- This ensures that (riftId, milestoneIndex) combination is unique

-- First, check if there are any existing duplicates and handle them
-- (This migration assumes no duplicates exist, but we check first)

DO $$
BEGIN
  -- Check for duplicates
  IF EXISTS (
    SELECT 1
    FROM "MilestoneRelease"
    GROUP BY "riftId", "milestoneIndex"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate milestone releases found. Please clean up duplicates before applying this migration.';
  END IF;
END $$;

-- Add unique constraint
ALTER TABLE "MilestoneRelease"
ADD CONSTRAINT "MilestoneRelease_riftId_milestoneIndex_key" 
UNIQUE ("riftId", "milestoneIndex");




