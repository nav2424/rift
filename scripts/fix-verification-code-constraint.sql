-- Fix: Make userId nullable in VerificationCode table
-- This allows verification codes to be associated with either userId (existing users) or sessionId (signup sessions)
-- Run this in your Supabase SQL Editor or via psql

-- First, check if the column is already nullable
DO $$ 
BEGIN
    -- Check if userId column has NOT NULL constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'VerificationCode' 
        AND column_name = 'userId' 
        AND is_nullable = 'NO'
    ) THEN
        -- Make userId nullable
        ALTER TABLE "VerificationCode" 
        ALTER COLUMN "userId" DROP NOT NULL;
        
        RAISE NOTICE 'Made userId column nullable';
    ELSE
        RAISE NOTICE 'userId column is already nullable';
    END IF;
END $$;

-- Ensure sessionId column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'VerificationCode' 
        AND column_name = 'sessionId'
    ) THEN
        ALTER TABLE "VerificationCode" 
        ADD COLUMN "sessionId" TEXT;
        
        RAISE NOTICE 'Added sessionId column';
    ELSE
        RAISE NOTICE 'sessionId column already exists';
    END IF;
END $$;

-- Ensure signup_sessions table exists
CREATE TABLE IF NOT EXISTS "signup_sessions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "birthday" TIMESTAMP(3),
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordSet" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signup_sessions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint for sessionId if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'VerificationCode_sessionId_fkey'
    ) THEN
        ALTER TABLE "VerificationCode" 
        ADD CONSTRAINT "VerificationCode_sessionId_fkey" 
        FOREIGN KEY ("sessionId") 
        REFERENCES "signup_sessions"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint for sessionId';
    ELSE
        RAISE NOTICE 'Foreign key constraint for sessionId already exists';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "VerificationCode_sessionId_type_idx" ON "VerificationCode"("sessionId", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "signup_sessions_email_key" ON "signup_sessions"("email");
CREATE INDEX IF NOT EXISTS "signup_sessions_email_idx" ON "signup_sessions"("email");
CREATE INDEX IF NOT EXISTS "signup_sessions_expiresAt_idx" ON "signup_sessions"("expiresAt");

