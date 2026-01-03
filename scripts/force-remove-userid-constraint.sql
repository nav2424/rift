-- Force remove NOT NULL constraint from userId in VerificationCode table
-- This is a direct fix for the database constraint issue

-- Check current constraint state
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'VerificationCode' 
AND column_name = 'userId';

-- Remove NOT NULL constraint (this should work even if already nullable)
ALTER TABLE "VerificationCode" 
ALTER COLUMN "userId" DROP NOT NULL;

-- Verify the constraint was removed
SELECT 
    column_name, 
    is_nullable,
    data_type,
    CASE 
        WHEN is_nullable = 'YES' THEN '✅ Column is nullable'
        ELSE '❌ Column is NOT NULL'
    END as status
FROM information_schema.columns 
WHERE table_name = 'VerificationCode' 
AND column_name = 'userId';

