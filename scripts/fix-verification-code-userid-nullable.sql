-- Fix: Make userId nullable in VerificationCode table
-- This allows verification codes to be associated with either userId (existing users) or sessionId (signup sessions)

ALTER TABLE "VerificationCode" 
ALTER COLUMN "userId" DROP NOT NULL;
