-- Migration: Add SignupSession table
-- Run this in your Supabase SQL Editor or via psql

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "signup_sessions_email_key" ON "signup_sessions"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "signup_sessions_email_idx" ON "signup_sessions"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "signup_sessions_expiresAt_idx" ON "signup_sessions"("expiresAt");

-- AlterTable (Update VerificationCode to support sessionId)
ALTER TABLE "VerificationCode" 
ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- AddForeignKey
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
    END IF;
END $$;

-- CreateIndex (for sessionId)
CREATE INDEX IF NOT EXISTS "VerificationCode_sessionId_type_idx" ON "VerificationCode"("sessionId", "type");

