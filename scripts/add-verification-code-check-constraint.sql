-- Add check constraint to ensure either userId or sessionId is present
-- This prevents creating verification codes with both fields null

-- Remove existing constraint if it exists
ALTER TABLE "VerificationCode" 
DROP CONSTRAINT IF EXISTS "VerificationCode_user_or_session";

-- Add check constraint: either userId OR sessionId must be NOT NULL
ALTER TABLE "VerificationCode"
ADD CONSTRAINT "VerificationCode_user_or_session"
CHECK (
  ("userId" IS NOT NULL) OR ("sessionId" IS NOT NULL)
);

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'VerificationCode'::regclass
AND conname = 'VerificationCode_user_or_session';

