-- Direct fix: Remove NOT NULL constraint from userId in VerificationCode
-- This script uses multiple methods to ensure the constraint is removed

-- Method 1: Try to drop NOT NULL constraint directly
DO $$ 
BEGIN
    -- Check if column exists and has NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'VerificationCode' 
        AND column_name = 'userId' 
        AND is_nullable = 'NO'
    ) THEN
        -- Remove NOT NULL constraint
        ALTER TABLE "VerificationCode" 
        ALTER COLUMN "userId" DROP NOT NULL;
        
        RAISE NOTICE 'Removed NOT NULL constraint from userId';
    ELSE
        RAISE NOTICE 'userId column is already nullable or does not exist';
    END IF;
END $$;

-- Method 2: If the above didn't work, try recreating the column
-- (This is more aggressive but ensures the constraint is removed)
DO $$ 
BEGIN
    -- Check current state
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'VerificationCode' 
        AND column_name = 'userId'
        AND is_nullable = 'NO'
    ) THEN
        -- Drop and recreate column as nullable
        ALTER TABLE "VerificationCode" 
        DROP COLUMN IF EXISTS "userId";
        
        ALTER TABLE "VerificationCode" 
        ADD COLUMN "userId" TEXT;
        
        -- Re-add foreign key if it exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'VerificationCode_userId_fkey'
        ) THEN
            ALTER TABLE "VerificationCode" 
            ADD CONSTRAINT "VerificationCode_userId_fkey" 
            FOREIGN KEY ("userId") 
            REFERENCES "User"("id") 
            ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Recreated userId column as nullable';
    END IF;
END $$;

-- Verify final state
SELECT 
    column_name, 
    is_nullable,
    CASE 
        WHEN is_nullable = 'YES' THEN '✅ Column is nullable'
        ELSE '❌ Column is NOT NULL - constraint still exists'
    END as status
FROM information_schema.columns 
WHERE table_name = 'VerificationCode' 
AND column_name = 'userId';

