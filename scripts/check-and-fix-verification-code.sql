-- Check current state
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'VerificationCode' 
AND column_name IN ('userId', 'sessionId')
ORDER BY column_name;

-- Fix: Make userId nullable
ALTER TABLE "VerificationCode" 
ALTER COLUMN "userId" DROP NOT NULL;

-- Verify the fix
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'VerificationCode' 
AND column_name IN ('userId', 'sessionId')
ORDER BY column_name;

