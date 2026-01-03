-- Force fix: Remove NOT NULL constraint from userId in VerificationCode table
-- This script handles both possible table name cases

-- First, try with quoted table name (PostgreSQL default)
DO $$ 
BEGIN
    -- Check if constraint exists and remove it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'VerificationCode' 
        AND ccu.column_name = 'userId'
        AND tc.constraint_type = 'CHECK'
    ) THEN
        -- Drop any CHECK constraints on userId
        EXECUTE (
            SELECT 'ALTER TABLE "VerificationCode" DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'VerificationCode'
            AND constraint_name LIKE '%userId%'
            LIMIT 1
        );
    END IF;
    
    -- Make column nullable
    BEGIN
        ALTER TABLE "VerificationCode" ALTER COLUMN "userId" DROP NOT NULL;
        RAISE NOTICE 'Successfully made userId nullable';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error altering column: %', SQLERRM;
    END;
END $$;

-- Verify the column is now nullable
SELECT 
    column_name, 
    is_nullable,
    CASE 
        WHEN is_nullable = 'YES' THEN '✅ Column is nullable'
        ELSE '❌ Column is NOT NULL'
    END as status
FROM information_schema.columns 
WHERE table_name = 'VerificationCode' 
AND column_name = 'userId';

